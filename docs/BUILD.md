# How to build the code for production deployment

The javascript provided here can be used as-is if required (see DEV.md).  For production deployment, though,
the assets should be compiled to minimise the number of HTTP requests to retrieve the code, and the size of
the code itself.

In this project we use a simple approach to build, using a command-line bash script.

As the build script uses bash, this document will assume that you are using Linux.


## Dependencies

Before running the script, you need to install NodeJS.  You can obtain this from:

https://nodejs.org/en/download/

You should then follow the instructions suitable for your platform.  For example, if installing on Ubuntu, you can use:

https://github.com/nodesource/distributions#debinstall


## Preparation

The build.sh script in the root of the repository needs to know the path to NodeJS in order to run.  If you have
installed Node on a Ubuntu system, you will probably find that the script needs no modification, as it assumes
you have the command "nodejs" available on your system.  TryL

    which nodejs
    
to confirm.

If your nodejs executable is not available by typing "nodejs" at the command line (e.g. if you are using the 
node version manager), you will need to provide the path to it in the script.  Edit build.sh, and change the 
line at the top:

    NODEJS="nodejs"

Such that the right hand side contains the path to your NodeJS executable.


## Build

Simply execute the build.sh script in the root of the code repository:

    sh build.sh
    
This will produce the compiled source JS and CSS plus dependencies into the /release directory.


## Modification

If you make changes to the source code for the project, you need to update the build.sh file to include those changes
in the build.

* Additional JavaScript sources - add these under the section with the title "JavaScript source handling"
* Additional JavaScript dependencies (e.g. third party libraries) - add these under the section with the title "JS Dependencies handling"
* Additional CSS sources - add these under the section with the title "CSS source handling"
* Additional CSS dependencies (e.g. third party libraries) - add these under the section with the title "CSS Dependencies handling"
