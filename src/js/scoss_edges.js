/**
 * Namespace that contains all the code for deploying the SCOSS data visualisation
 *
 * @namespace
 */
var scoss = {
    /**
     * A place to store the active instance of the Edge(s) created in this run.  Edges should be
     * stored with their selector as the key, and their instance as the value.
     *
     * @member {Object}
     */
    activeEdges : {},

    /**
     * A function that returns a number formatted according to our currency output rules that is compliant
     * with the HTML character encoding requirements.  This should be used wherever the number will be rendered
     * in plain HTML.
     *
     * @function
     */
    euroFormatter : edges.numFormat({
        prefix: "&euro;",
        thousandsSeparator: ","
    }),

    /**
     * A function that returns a number formatted according to our currency output rules that is uses the unicode
     * character for Euros.  This is necessary when used inside SVG which does not handle HTML escaped characters
     * in the same way as plain HTML.
     *
     * @function
     */
    currencyFormatter : edges.numFormat({
        prefix: "€",
        thousandsSeparator: ","
    }),

    continentPercentFormatterClosure : function(selector) {
        return function(val) {
            var edge = scoss.activeEdges[selector];

            var total = edge.resources.master_aggregations.total_committed.sum;

            var pc = 100;
            if (total > 0) {
                pc = Math.round((val / total) * 100);
            }
            
            var s = scoss.currencyFormatter(val);
            s += " (" + pc + "%)";

            return s
        }
    },

    /**
     * Closure which returns a function which can be applied to the MasterSheet in the edge.resources
     * area.
     *
     * The returned function applies a filter based on the passed service_id, and then applies the aggregations
     * required for the entire visualisation.  The resulting aggregations are written into edge.resources.master_aggregation
     *
     * @param {Object} args
     * @param {string} args.service_id - the service id that we should filter the master sheet for
     * @returns {Function}
     */
    preprocessMasterSheet : function(args) {
        var service_id = args.service_id;

        return function(params) {
            var resource = params.resource;
            var edge = params.edge;

            // apply the filter for the service ID based on the value of service_id in the closure
            resource.add_filter({filter: {field: "Service ID", value: service_id, type: "exact"}});

            // run all the aggregations that the visualisations will need
            var aggs = [
                // total all the funds committed to this service provider
                edges.csv.newSumAggregation({
                    name: "total_committed",
                    field: "Funding Committed (EUR)"
                }),

                // total all the funds paid to this service provider
                edges.csv.newSumAggregation({
                    name: "total_paid",
                    field: "Total Paid (EUR)"
                }),

                // list all the countries that appear in the master data, and total the funds committed by each of them
                edges.csv.newTermsAggregation({
                    name : "country",
                    field: "Funder Country",
                    nested : [
                        edges.csv.newSumAggregation({
                            name: "total_committed",
                            field: "Funding Committed (EUR)"
                        })
                    ]
                }),

                // lis all the continents that appear in the master data, and total the funds committed by each of them
                edges.csv.newTermsAggregation({
                    name : "continent",
                    field: "Funder Continent",
                    nested : [
                        edges.csv.newSumAggregation({
                            name: "total_committed",
                            field: "Funding Committed (EUR)"
                        })
                    ]
                }),

                // list all the funders that appear in the master data, ordered alphabetically, and the total funds committed
                // by each of them
                edges.csv.newTermsAggregation({
                    name : "funders",
                    field: "Funder Full Name",
                    order: "term",
                    nested : [
                        edges.csv.newSumAggregation({
                            name: "total_committed",
                            field: "Funding Committed (EUR)"
                        })
                    ]
                })
            ];

            // store the aggregations as a resource
            edge.resources["master_aggregations"] = resource.applyAggregations({aggs: aggs});
        }
    },

    /**
     * Closure which returns a function which pre-processes the service provider resource in edge.resources
     *
     * The returned function applies a filter based on the service_id, and then extracts the resulting service
     * provider record into edge.resources.service_provider
     *
     * @param {Object} args
     * @param {string} args.service_id - the service id that we should filter the service provider sheet for
     * @returns {Function}
     */
    preprocessServiceProviderSheet : function(args) {
        var service_id = args.service_id;

        return function(params) {
            var resource = params.resource;
            var edge = params.edge;

            // apply the service id filter
            resource.add_filter({filter: {field: "Service ID", value: service_id, type: "exact"}});

            // get the first record (there should be only one) and write it to edge.resources.service_provider
            var iter = resource.iterator();
            edge.resources["service_provider"] = iter.next();
        }
    },

    /**
     * Function which works out how much progress has been made towards the Service Provider's target
     * in terms of committed funds.
     *
     * This takes the target from the service_provider resource, and the total committed from the total_committed
     * aggregation on the master sheet resource.
     *
     * It returns a percentage up to 100%, which is capped, even if more is committed.  It also returns the amount
     * and the target as "x" and "y" respectively, so you can say Z% (X of Y).
     *
     * @param {edges.Component} component - the Edges component which called this function
     * @returns {{pc: number, x: number, y: number}}
     */
    progressCommitted : function(component) {
        var aggs = component.edge.resources.master_aggregations;
        var results = aggs.total_committed;

        var provider = component.edge.resources.service_provider;
        var parser = edges.numParse();

        var total = results.sum;
        var target = provider["Funding Target (EUR)"];
        target = parser(target);

        var pc = 0;
        if (total !== 0) {
            pc = 0;
        }
        pc = (total / target) * 100;
        if (pc > 100) {
            pc = 100;
        }

        return {pc: pc, x: total, y : target};
    },

    /**
     * Function which works out how much progress has been made towards the Service Provider's target
     * in terms of paid funds.
     *
     * This takes the target from the service_provider resource, and the total paid from the total_paid
     * aggregation on the master sheet resource.
     *
     * It returns a percentage up to 100%, which is capped, even if more is paid.  It also returns the amount
     * and the target as "x" and "y" respectively, so you can say Z% (X of Y).
     *
     * @param {edges.Component} component - the Edges component which called this function
     * @returns {{pc: number, x: number, y: number}}
     */
    progressPaid : function(component) {
        var aggs = component.edge.resources.master_aggregations;
        var results = aggs.total_paid;

        var provider = component.edge.resources.service_provider;
        var parser = edges.numParse();

        var total = results.sum;
        var target = provider["Funding Target (EUR)"];
        target = parser(target);

        var pc = 0;
        if (total !== 0) {
            pc = 0;
        }
        pc = (total / target) * 100;
        if (pc > 100) {
            pc = 100;
        }

        return {pc: pc, x: total, y : target};
    },

    /**
     * Function which works out how much remains of the service provider's target
     *
     * This function is essentially the inverse of {@link scoss.progressCommitted}, so it works by first calling
     * that function, then reversing the numbers as appropriate.
     *
     * It returns a percentage up to 100%, which is capped, even if more is paid.  It also returns the amount
     * and the target as "x" and "y" respectively, so you can say Z% (X of Y).
     *
     * @param {edges.Component} component - the Edges component which called this function
     * @returns {{pc: number, x: number, y: number}}
     */
    progressNeeded : function(component) {
        var committed = scoss.progressCommitted(component);

        var pc = 100 - committed.pc;
        var target = committed.y;
        var total = target - committed.x;
        if (total < 0) {
            total = 0;
        }
        return {pc: pc, x: total, y : target};
    },

    /**
     * Data Function which produces source data for the "By Country" chart.
     *
     * This fills a single data series with data from the country and the nested total_committed aggregations
     * on the master_aggregations resource.
     *
     * Countries are sorted according to their contribution.
     *
     * Resulting data series is of the form
     *
     * <pre>
     * [
     *  {
     *      key: "Total Funding",
     *      values: [
     *      {
     *          label: "Country",
     *          value: number
     *      }
     *      ]
     *   }
     * ]
     * </pre>
     *
     * @param {edges.Component} chart - chart that called this data function
     * @returns {Array} - data series suitable for plugging into chart renderers
     */
    countryDF : function(chart) {
        var aggs = chart.edge.resources.master_aggregations;
        var results = aggs.country;

        var series = {key: "Total Funding", values: []};
        for (var i = 0; i < results.buckets.length; i++) {
            var term = results.buckets[i];
            var country = term.term;
            var sum = term.aggs.total_committed.sum;
            series.values.push({label: country, value: sum});
        }

        // function that sorts countries by their total commitment
        function sortCountries(a, b) {
            return b.value - a.value;
        }

        series.values.sort(sortCountries);

        return [series];
    },

    /**
     * Data Function which produces source data for the "By Continent" chart.
     *
     * This fills a single data series with data from the continent and the nested total_committed aggregations
     * on the master_aggregations resource.
     *
     * Resulting data series is of the form
     *
     * <pre>
     * [
     *  {
     *      key: "Total Funding",
     *      values: [
     *      {
     *          label: "Continent",
     *          value: number
     *      }
     *      ]
     *   }
     * ]
     * </pre>
     *
     * @param {edges.Component} chart - chart that called this data function
     * @returns {Array} - data series suitable for plugging into chart renderers
     */
    continentDF : function(chart) {
        var aggs = chart.edge.resources.master_aggregations;
        var results = aggs.continent;

        var series = {key: "Total Funding", values: []};
        for (var i = 0; i < results.buckets.length; i++) {
            var term = results.buckets[i];
            var continent = term.term;
            var sum = term.aggs.total_committed.sum;
            series.values.push({label: continent, value: sum});
        }

        // function that sorts continents by their total commitment
        function sortContinents(a, b) {
            return b.value - a.value;
        }

        series.values.sort(sortContinents);

        return [series];
    },

    /**
     * Closure which returns a Data Function which produces source data for the "Top Donors/Members" chart.
     *
     * The returned function fills a single data series with data from the funders and the nested total_committed aggregations
     * on the master_aggregations resource.
     *
     * Funders are sorted according to their contribution.
     *
     * The number of funders returned is limited to the number supplied to this closure, and the limit is applied after sorting.
     *
     * Resulting data series is of the form
     *
     * <pre>
     * [
     *  {
     *      key: "Total Funding",
     *      values: [
     *      {
     *          label: "Funder",
     *          value: number
     *      }
     *      ]
     *   }
     * ]
     * </pre>
     *
     * @param {Object} params
     * @param {number} params.limit - the maximum number of funders to return (it will return less if there are not that many funders)
     * @returns {Array} - data series suitable for plugging into chart renderers
     */
    topDonorsDFClosure : function(params) {
        var limit = params.limit;

        return function(chart) {
            var aggs = chart.edge.resources.master_aggregations;
            var funders = aggs.funders;

            var series = {key: "Total Funding", values: []};
            for (var i = 0; i < funders.buckets.length; i++) {
                var term = funders.buckets[i];
                var funder = term.term;
                var sum = term.aggs.total_committed.sum;
                series.values.push({label: funder, value: sum});
            }

            // function to sort funders by contribution
            function sortFunders(a, b) {
                return b.value - a.value;
            }

            // sort and then limit the return number
            series.values.sort(sortFunders);
            series.values = series.values.slice(0, limit);

            return [series];
        }
    },

    /**
     * Function to build the full service provider page.  This constructs the Edge with all the appropriate components
     * and stores it in {@link scoss.activeEdges} using the value of params.selector as the key.
     *
     * This function will initialise the edge into the page element identified by params.selector.
     *
     * This function is responsible for triggering the load of the service provider and master sheet CSVs.
     *
     * @param {Object} params
     * @param {string} params.selector - the jQuery selector for the page element into which to render the Edge
     * @param {number} params.top_donor_limit - the number of Donors/Members to include in the Top X Donor/Member chart
     * @param {String} params.funding_progress_header - header text
     * @param {String} params.funding_progress_intro - section intro text
     * @param {String} params.funding_by_country_header - header text
     * @param {String} params.funding_by_country_intro - section intro text
     * @param {String} params.funding_by_continent_header - header text
     * @param {String} params.funding_by_continent_intro - section intro text
     * @param {String} params.top_donor_header - header text.  "{x}" will be replaced with params.top_donor_limit if present
     * @param {String} params.top_donor_intro - section intro text
     * @param {String} params.all_donors_header - header text
     * @param {String} params.all_donors_intro - section intro text
     * @param {string} service_id - the service ID of the provider this report is centred around.
     * @param {string} service_registry - URL to the Service Registry CSV.  Must be accessible by this script (e.g. in the same domain)
     * @param {string} master_data - URL to the Master Sheet CSV.  Must be accessible by this script (e.g. in the same domain)
     */
    makeServiceProviderPage : function(params) {
        // create the new Edge and store it in scoss.activeEdges with the selector as the key
        scoss.activeEdges[params.selector] = edges.newEdge({
            selector: params.selector,

            // initialise the template around the top donor limit
            template: scoss.newServiceProviderPageTemplate({
                top_donor_limit: edges.getParam(params.top_donor_limit, 10),
                funding_progress_header: edges.getParam(params.funding_progress_header, "Funding progress"),
                funding_progress_intro: edges.getParam(params.funding_progress_intro, ""),
                funding_by_country_header: edges.getParam(params.funding_by_country_header, "Funds committed by country"),
                funding_by_country_intro: edges.getParam(params.funding_by_country_intro, ""),
                funding_by_continent_header: edges.getParam(params.funding_by_continent_header, "Funds committed by continent"),
                funding_by_continent_intro: edges.getParam(params.funding_by_continent_intro, ""),
                top_donor_header: edges.getParam(params.top_donor_header, "Top {x} crowdfunders/members"),
                top_donor_intro: edges.getParam(params.top_donor_intro, ""),
                all_donors_header: edges.getParam(params.funding_by_continent_header, "All crowdfunders/members"),
                all_donors_intro: edges.getParam(params.funding_by_continent_intro, "")
            }),

            // specify the static files to be loaded:
            // 1. The service registry
            // 2. The master data
            // each of these is loaded by PapaParse, and made available as an edges.csv.ObjectByRow, which allows
            // filtering and aggregating.
            // Once loaded, each static file has its own pre-processor applied, which filters them by the service_id and
            // applies any required aggregations for later use in the visualisation
            staticFiles : [
                {
                    id : "service_registry",
                    url : params.service_registry,
                    processor : edges.csv.newObjectByRow,
                    datatype : "text",
                    opening: scoss.preprocessServiceProviderSheet({service_id: params.service_id})
                },
                {
                    id : "master_data",
                    url : params.master_data,
                    processor : edges.csv.newObjectByRow,
                    datatype : "text",
                    opening: scoss.preprocessMasterSheet({service_id: params.service_id})
                }
            ],

            // specify the components of this visualisation
            components : [
                // The first 3 components are "loading bars" used to display the progress towards the target
                // for each service provider.  There are 3 bars: progress to committed, progress to paid, amount needed
                // to be committed.
                edges.loading.newLoadingBar({
                    id : "progress_committed",
                    calculate : scoss.progressCommitted,
                    renderer : edges.loading_io.newLoadingIORendererBS3({
                        preset: "circle",
                        title: "<h3>Committed</h3>",
                        showXofY: true,
                        xyNumFormat: scoss.euroFormatter
                    })
                }),
                edges.loading.newLoadingBar({
                    id : "progress_paid",
                    calculate : scoss.progressPaid,
                    renderer : edges.loading_io.newLoadingIORendererBS3({
                        preset: "circle",
                        title: "<h3>Paid</h3>",
                        showXofY: true,
                        xyNumFormat: scoss.euroFormatter
                    })
                }),
                edges.loading.newLoadingBar({
                    id : "progress_needed",
                    calculate : scoss.progressNeeded,
                    renderer : edges.loading_io.newLoadingIORendererBS3({
                        preset: "circle",
                        title: "<h3>Needed</h3>",
                        showXofY: true,
                        xyNumFormat: scoss.euroFormatter
                    })
                }),

                // This component provides a horizontal multibar of the countries that have contributed.  It is
                // dynamically sized based on the number of bars it must render.
                edges.newHorizontalMultibar({
                    id: "by_country",
                    dataFunction: scoss.countryDF,
                    renderer : edges.nvd3.newHorizontalMultibarRenderer({
                        legend: false,
                        dynamicHeight: true,
                        barHeight: 40,
                        reserveAbove: 50,
                        reserveBelow: 50,
                        groupSpacing: 0.5,
                        yTickFormat: scoss.currencyFormatter,
                        valueFormat: scoss.currencyFormatter,
                        yAxisLabel: "Total Funding (EUR)"
                    })
                }),

                // This component provides a pie chart of the continents that have contributed.
                edges.newPieChart({
                    id : "by_continent",
                    dataFunction: scoss.continentDF,
                    renderer : edges.nvd3.newPieChartRenderer({
                        // valueFormat: scoss.currencyFormatter,
                        valueFormat: scoss.continentPercentFormatterClosure(params.selector),
                        labelsOutside: true,
                        color: false
                    })
                }),

                // This component provides a horizontal multibar of the top X donors.  It is
                // dynamically sized based on the number of bars it must render.
                edges.newHorizontalMultibar({
                    id: "top_donors",
                    dataFunction: scoss.topDonorsDFClosure({limit: params.top_donor_limit}),
                    renderer : edges.nvd3.newHorizontalMultibarRenderer({
                        legend: false,
                        dynamicHeight: true,
                        barHeight: 30,
                        reserveAbove: 50,
                        reserveBelow: 50,
                        yTickFormat: scoss.currencyFormatter,
                        valueFormat: scoss.currencyFormatter,
                        yAxisLabel: "Total Funding (EUR)"
                    })
                }),

                // This custom component (defined below) gathers together the information to be tabulated
                // at the bottom of the visualisation.  It uses, then, a standard bs3 tabular results renderer
                // to output that.
                scoss.newDonorList({
                    id: "all_donors",
                    renderer: edges.bs3.newTabularResultsRenderer({
                        fieldDisplay: [
                            {field: "donor", display: "Donor/Member"},
                            {field: "committed", display: "Committed", valueFunction: scoss.euroFormatter}
                        ]
                    })
                })
            ]
        })
    },

    /**
     * This function constructs {@link scoss.ServiceProviderPageTemplate} for you, with appropriate
     * prototypes
     *
     * @param {Object} params
     * @param {number} params.top_donor_limit - maximum number of donors to display.
     * @returns {scoss.ServiceProviderPageTemplate}
     */
    newServiceProviderPageTemplate : function(params) {
        return edges.instantiate(scoss.ServiceProviderPageTemplate, params, edges.newTemplate)
    },
    /**
     * You should not call this directly, see {@link scoss.newServiceProviderPageTemplate} for the true
     * constructor.
     *
     * This class represents the SCOSS page template.
     *
     * @extends edges.Component
     * @param {Object} params
     * @param {number} params.top_donor_limit - maximum number of donors to display.
     * @constructor
     */
    ServiceProviderPageTemplate : function(params) {
        this.params = params;

        this.namespace = "scoss-spp";

        this.draw = function(edge) {
            this.edge = edge;

            var containerClass = edges.css_classes(this.namespace, "container");
            var sectionClass = edges.css_classes(this.namespace, "section");
            var progressCommittedClass = edges.css_classes(this.namespace, "progress_committed");
            var progressPaidClass = edges.css_classes(this.namespace, "progress_paid");
            var progressNeededClass = edges.css_classes(this.namespace, "progress_needed");
            var countryClass = edges.css_classes(this.namespace, "country");
            var continentClass = edges.css_classes(this.namespace, "continent");
            var topDonorsClass = edges.css_classes(this.namespace, "top-donors");
            var allDonorsClass = edges.css_classes(this.namespace, "all-donors");

            var donorHeader = this.params.top_donor_header.replace("{x}", this.params.top_donor_limit);

            var frag = '<div class="' + containerClass + '">\
                    <div class="' + sectionClass + '">\
                        <div class="row"><div class="col-md-12"><h2>' + this.params.funding_progress_header + '</h2>' + this.params.funding_progress_intro + '</div></div>\
                        <div class="row">\
                            <div class="col-md-2 col-md-offset-2"><div id="progress_committed" class="' + progressCommittedClass + '"></div></div>\
                            <div class="col-md-2 col-md-offset-1"><div id="progress_paid" class="' + progressPaidClass + '"></div></div>\
                            <div class="col-md-2 col-md-offset-1"><div id="progress_needed" class="' + progressNeededClass + '"></div></div>\
                        </div>\
                    </div> \
                    <div class="' + sectionClass + '">\
                        <div class="row"><div class="col-md-12">\
                            <h2>' + this.params.funding_by_country_header + '</h2>' + this.params.funding_by_country_intro + '\
                            <div id="by_country" class="' + countryClass + '"></div>\
                        </div></div>\
                    </div>\
                    <div class="' + sectionClass + '">\
                        <h2>' + this.params.funding_by_continent_header + '</h2>' + this.params.funding_by_continent_intro + '\
                        <div class="row"><div class="col-md-12"><div id="by_continent" class="' + continentClass + '"></div></div></div>\
                    </div>\
                    <div class="' + sectionClass + '">\
                        <h2>' + donorHeader + '</h2>' + this.params.top_donor_intro + '\
                        <div class="row"><div class="col-md-12"><div id="top_donors" class="' + topDonorsClass + '"></div></div></div>\
                    </div>\
                    <div class="' + sectionClass + '">\
                        <h2>' + this.params.all_donors_header + '</h2>' + this.params.all_donors_intro + '\
                        <div class="row"><div class="col-md-10 col-md-offset-1"><div id="all_donors" class="' + allDonorsClass + '"></div></div></div>\
                    </div>\
                </div></div>';

            edge.context.html(frag);
        }
    },

    /**
     * This function constructs {@link scoss.ServiceProviderPageTemplate} for you, with appropriate
     * prototypes
     *
     * @param {Object} params - optional, no parameters currently required
     * @returns {scoss.DonorList}
     */
    newDonorList : function(params) {
        return edges.instantiate(scoss.DonorList, params, edges.newComponent);
    },
    /**
     * You should not call this directly, see {@link scoss.newDonorList} for the true
     * constructor.
     *
     * This component, whens synchronised, looks in the funders aggregation in the master_aggregations resource
     * and produces a table of funders and committed amounts, organised alphabetically.
     *
     * @extends edges.Component
     * @param {Object} params - optional, no parameters currently required
     * @constructor
     */
    DonorList : function(params) {
        this.results = [];

        this.synchronise = function() {
            this.results = [];

            var funders = this.edge.resources.master_aggregations.funders;
            for (var i = 0; i < funders.buckets.length; i++) {
                var funder = funders.buckets[i];
                this.results.push({donor: funder.term, committed: funder.aggs.total_committed.sum});
            }
        };
    }
};
