# Deployment (under WordPress)

Before proceeding, ensure you have access to the latest version of the production build assets.  These are in the code
repository under /release.  If you do not have them, or want to update them, please see BUILD.md for information.

## JavaScript/CSS Dependencies

The data visualisation depends on the following common shared JavaScript and CSS libraries:

* JQuery 1.11.1
* D3 3.5.17
* NVD3 1.8.1
* PapaParse 4.1.2
* LoadingBar.io latest version
* Twitter Bootstrap 3.3.1

Before you deploy the software, you should be sure that these dependencies will not interfere with
your existing site dependencies, or that you already have equivalent or compatible versions on your site.


## Source Data

Two CSVs drive the data visualisations, and these must be available at a URL inside the WordPress
domain, so that the front-end JavaScript application can load them.  URLs outside the domain the
software is running in **will not work**.

The following Google URLs must be proxied into the local domain:

* The Service Registry:
https://docs.google.com/spreadsheets/d/e/2PACX-1vSKc5TwvLSfWvMsR78f8Vukfcs4quc2-4SVm93pSErv3uMuue6XYJ9KDo_N3m4e51qZQfvcOES86awC/pub?gid=0&single=true&output=csv

Current Proxy URL: https://sparceurope.org/sparcgdocs/feed/1


* The Master Data:
https://docs.google.com/spreadsheets/d/e/2PACX-1vSYajOCI-_ZxRnFupQVNsOpmnL98wi06OmonQGoG01TZ4rx1atv-ShQzxKEVSE0vrjpzB3u2TwiAykj/pub?gid=1249817261&single=true&output=csv

Current Proxy URL: https://sparceurope.org/sparcgdocs/feed/2


We will use the localised versions of these URLs later when we configure the visualisation:


## Page Template

A full page which implements the data visualisation looks as follows:

    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>SCOSS Testing Site - DOAJ Built JS Version</title>
    
        <link rel="stylesheet" href="/release/scoss.dep.css">
        <link rel="stylesheet" href="/release/scoss.min.css">
    
    </head>
    <body>
    
    <div class="container"><div class="content">
        <div class="row">
            <div class="col-md-12">
                <p><a href="doaj_build.html">DOAJ</a> | <a href="romeo_build.html">ROMEO</a></p>
                <h1>Directory of Open Access Journals</h1>
                <p>Some blurb here about the DOAJ.</p>
            </div>
        </div>
        <div id="service_provider_page"></div>
    </div></div>
    
    <script type="text/javascript" src="/release/scoss.dep.js"></script>
    <script type="text/javascript" src="/release/scoss.min.js"></script>
    
    <script type="application/javascript">
        jQuery(document).ready(function($) {
            scoss.makeServiceProviderPage({
                selector: "#service_provider_page",
                service_registry : "https://sparceurope.org/sparcgdocs/feed/1",
                master_data : "https://sparceurope.org/sparcgdocs/feed/2",
                service_id : "DOAJ",
                top_donor_limit: 10
            });
        });
    </script>
    
    </body>
    </html>


We need to set up a WordPress page so that it is equivalent to this.

If you wish to load the css and javascript assets from your site template, then you need to include the following in the
site template:

    <link rel="stylesheet" href="/release/scoss.dep.css">
    <link rel="stylesheet" href="/release/scoss.min.css">
    
    <script type="text/javascript" src="/release/scoss.dep.js"></script>
    <script type="text/javascript" src="/release/scoss.min.js"></script>
    
You will need to include the css and js files in the /release directory of this code library into a common location
in your wordpress instance, and then update the href/src attributes above to point to them.

You should then create an individual page for each Service Provider (e.g. DOAJ and Romeo), and on that page place the
following HTML fragment:


    <div class="container"><div class="content">
        <div class="row">
            <div class="col-md-12">
                <p><a href="doaj_build.html">DOAJ</a> | <a href="romeo_build.html">ROMEO</a></p>
                <h1>Directory of Open Access Journals</h1>
                <p>Some blurb here about the DOAJ.</p>
            </div>
        </div>
        <div id="service_provider_page"></div>
    </div></div>
    
    <script type="application/javascript">
        jQuery(document).ready(function($) {
            scoss.makeServiceProviderPage({
                selector: "#service_provider_page",
                service_registry : "https://sparceurope.org/sparcgdocs/feed/1",
                master_data : "https://sparceurope.org/sparcgdocs/feed/2",
                service_id : "DOAJ",
                top_donor_limit: 10
            });
        });
    </script>
    

You shoud then customise this fragment as needed for the particular page.  For example, add the 
descriptive text about the Service provider, and any links/navigation you require to other pages.

The most important bits of this page are the div with id "serivice_provider_page" and the javascript 
fragment beneath it.  The next section describes how this javascript works.


## Customising the deployment javascript

The data visualisation is triggered by the function scoss.makeServiceProviderPage, which is invoked when the page
loads using jQuery:

    jQuery(document).ready(function($) {
        scoss.makeServiceProviderPage({...});
    });

The arguments that you pass to this function determine how the visualisation will behave.

The following arguments are available to you, and should be set on each page the visualisation will be
presented:


* selector - this specifies the jQuery selector of the element into which to serve the visualisation.
* service_registry - the URL in the WordPress domain from which to obtain the Service Registry CSV
* master_data - the URL in the WordPress domain from which to obtain the Service Registry CSV
* service_id - the ID of the service this page is for.  This MUST match the Service ID as specifed in the Service Registry and used in the Master Data.
* top_donor_limit - the number of donors to include in the Top X Donors visualisation.  Defaults to 10.

For example, the following fragment renders the visualisation into the div with id "service_provider_page", using the test service and master
data on a local machine.  It is providing the report for Sherpa Romeo, and the number of donors to display in the top donor list is 5:

    jQuery(document).ready(function($) {
        scoss.makeServiceProviderPage({
            selector: "#service_provider_page",
            service_registry : "https://sparceurope.org/sparcgdocs/feed/1",
            master_data : "https://sparceurope.org/sparcgdocs/feed/2",
            service_id : "ROMEO",
            top_donor_limit: 5
        });
    });
    

## Customising section headers and intro text

You can also customise the section headers and intro text, by passing additional arguments into the scoss.makeServiceProviderPage function:

* funding_progress_header - header text
* funding_progress_intro - section intro text
* funding_by_country_header - header text
* funding_by_country_intro - section intro text
* funding_by_continent_header - header text
* funding_by_continent_intro - section intro text
* top_donor_header - header text.  "{x}" will be replaced with top_donor_limit if present
* top_donor_intro - section intro text
* all_donors_header - header text
* all_donors_intro - section intro text

*_header elements will be placed inside <h2> tags.  

*_intro elements can contain any HTML you like.