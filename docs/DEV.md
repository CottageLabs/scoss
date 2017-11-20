# How to develop with this code

## Source Code

The source written specifically for this project is found in the /src directory.

This is divided into css and js files.  See the inline code documentation for
information on what all the parts do.


## Dependencies

This library has a number of dependencies.  The primary dependency is Edges,
which is in /vendor/edges

Edges in turn brings a number of transitive dependencies, which are documented
in the DEPLOY.md file.


## Build

To compile the SCOSS source, Edges components, and all transitive dependencies,
see BUILD.md


## Entry Points

In the root of the project are four HTML files, which can be used for testing:

* doaj.html - a page set up for developers, with all unminified dependencies included,
which renders the DOAJ report
* romeo.html - a page set up for developers, with all unminified dependencies included,
which renders the Sherpa/Romeo report
* doaj_build.html - a page set up to demonstrate deployment of the software using the 
compiled assets, which renders the DOAJ report.
* romeo_build.html - a page set up to demonstrate deployment of the software using the 
compiled assets, which renders the Sherpa/Romeo report.