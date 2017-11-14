#!/usr/bin/env bash


# variables to use for this run
OUT="release/"
EDGES="vendor/edges/"
R="vendor/edges/build/r.js"
MIN_JS="scoss.min.js"
BUILD_NOTE="build.txt"
DEP_JS="scoss.dep.js"
MIN_CSS="scoss.min.css"
DEP_CSS="scoss.dep.css"

# variables derived from the base configuration for this run
SRC=$OUT/js_src
BSRC=$OUT/js_build
MSRC=$OUT/$MIN_JS

DEP=$OUT/dep
MDEP=$OUT/$DEP_JS
CDEP=$OUT/$DEP_CSS

CSS=$OUT/css_src
BCSS=$OUT/css_build
MCSS=$OUT/$MIN_CSS

BUILD=$OUT/$BUILD_NOTE

# start by flattening out the output structure and rebuilding it
rm -r $OUT
mkdir $OUT
mkdir $SRC
mkdir $BSRC
mkdir $DEP
mkdir $CSS
mkdir $BCSS

####################################################
## JavaScript source handling

# now copy at the js into the SRC directory
cp $EDGES/src/edges.jquery.js $SRC
cp $EDGES/src/edges.js $SRC
cp $EDGES/src/edges.csv.js $SRC
cp $EDGES/src/components/charts.js $SRC
cp $EDGES/src/components/tables.js $SRC
cp $EDGES/src/renderers/nvd3.edges.js $SRC
cp src/js/scoss_edges.js $SRC

# compile all the javascript down to minified versions
nodejs $R -o appDir=$SRC baseDir=. dir=$BSRC

# combine all the js into a single file in the right order
cat $BSRC/edges.jquery.js <(echo) \
    $BSRC/edges.js <(echo) \
    $BSRC/edges.csv.js <(echo) \
    $BSRC/charts.js <(echo) \
    $BSRC/tables.js <(echo) \
    $BSRC/nvd3.edges.js <(echo) \
    $BSRC/scoss_edges.js <(echo) \
    > $MSRC

#######################################################
## JS Dependencies handling

# pull in all the dependencies
cp $EDGES/vendor/jquery-1.11.1/jquery-1.11.1.min.js $DEP
cp $EDGES/vendor/d3-3.5.17/d3.min.js $DEP
cp $EDGES/vendor/nvd3-1.8.1/nv.d3.js $DEP
cp $EDGES/vendor/PapaParse-4.1.2/papaparse.min.js $DEP

# combine all the dependencies into a single file in the right order
cat $DEP/jquery-1.11.1.min.js <(echo) \
    $DEP/d3.min.js <(echo) \
    $DEP/nv.d3.js <(echo) \
    $DEP/papaparse.min.js <(echo) \
    > $MDEP


######################################################
## CSS source handling

# copy the css into the build directory
cp src/css/scoss_edges.css $CSS

# minify each css file individually
nodejs $R -o cssIn=$CSS/scoss_edges.css out=$BCSS/scoss_edges.css baseUrl=.

# cat all the CSS into a single minified file
cat $BCSS/scoss_edges.css <(echo) \
    > $MCSS


########################################################
## CSS Dependencies handling

# copy all the css into the build directory
cp $EDGES/vendor/bootstrap-3.3.1/css/bootstrap.min.css $CSS
cp $EDGES/vendor/nvd3-1.8.1/nv.d3.css $CSS

# cat all the dependency CSS into a single file
cat $CSS/bootstrap.min.css <(echo) \
    $CSS/nv.d3.css <(echo) \
    > $CDEP


#######################################################
## Record the Build time and cleanup

echo "Build $(date -u +"%Y-%m-%dT%H:%M:%SZ")" > $BUILD

rm -r $BSRC
rm -r $SRC
rm -r $DEP
rm -r $CSS
rm -r $BCSS