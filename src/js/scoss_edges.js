var scoss = {
    activeEdges : {},

    preprocessMasterSheet : function(args) {
        var service_id = args.service_id;

        return function(params) {
            var resource = params.resource;
            var edge = params.edge;

            resource.add_filter({filter: {field: "Service ID", value: service_id, type: "exact"}});

            // run all the aggregations that the visualisations will need
            var aggs = [
                edges.csv.newSumAggregation({
                    name: "total_committed",
                    field: "Funding Committed (EUR)"
                }),
                edges.csv.newSumAggregation({
                    name: "total_paid",
                    field: "Total Paid (EUR)"
                }),
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

    preprocessServiceProviderSheet : function(args) {
        var service_id = args.service_id;

        return function(params) {
            var resource = params.resource;
            var edge = params.edge;

            resource.add_filter({filter: {field: "Service ID", value: service_id, type: "exact"}});

            var iter = resource.iterator();
            edge.resources["service_provider"] = iter.next();
        }
    },

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

        function sortCountries(a, b) {
            return b.value - a.value;
        }

        series.values.sort(sortCountries);

        return [series];
    },

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

        return [series];
    },

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

            function sortFunders(a, b) {
                return b.value - a.value;
            }

            series.values.sort(sortFunders);
            series.values = series.values.slice(0, limit);

            return [series];
        }
    },

    euroFormatter : edges.numFormat({
        prefix: "&euro;",
        thousandsSeparator: ","
    }),

    currencyFormatter : edges.numFormat({
        prefix: "€",
        thousandsSeparator: ","
    }),

    makeServiceProviderPage : function(params) {
        scoss.activeEdges[params.selector] = edges.newEdge({
            selector: params.selector,
            template: scoss.newServiceProviderPageTemplate({top_donor_limit: params.top_donor_limit}),
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
            components : [
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
                edges.newHorizontalMultibar({
                    id: "by_country",
                    dataFunction: scoss.countryDF,
                    renderer : edges.nvd3.newHorizontalMultibarRenderer({
                        legend: false,
                        dynamicHeight: true,
                        barHeight: 15,
                        reserveAbove: 50,
                        reserveBelow: 50,
                        yTickFormat: scoss.currencyFormatter,
                        valueFormat: scoss.currencyFormatter,
                        yAxisLabel: "Total Funding (EUR)"
                    })
                }),
                edges.newPieChart({
                    id : "by_continent",
                    dataFunction: scoss.continentDF,
                    renderer : edges.nvd3.newPieChartRenderer({
                        valueFormat: scoss.currencyFormatter,
                        labelsOutside: true,
                        color: false
                    })
                }),
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
    
    newServiceProviderPageTemplate : function(params) {
        return edges.instantiate(scoss.ServiceProviderPageTemplate, params, edges.newTemplate)
    },
    ServiceProviderPageTemplate : function(params) {
        this.topDonorLimit = edges.getParam(params.top_donor_limit, 10);

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

            var frag = '<div class="' + containerClass + '">\
                    <div class="' + sectionClass + '">\
                        <div class="row"><div class="col-md-12"><h2>Funding Progress</h2></div></div>\
                        <div class="row">\
                            <div class="col-md-2 col-md-offset-2"><div id="progress_committed" class="' + progressCommittedClass + '"></div></div>\
                            <div class="col-md-2 col-md-offset-1"><div id="progress_paid" class="' + progressPaidClass + '"></div></div>\
                            <div class="col-md-2 col-md-offset-1"><div id="progress_needed" class="' + progressNeededClass + '"></div></div>\
                        </div>\
                    </div> \
                    <div class="' + sectionClass + '">\
                        <div class="row"><div class="col-md-12">\
                            <h2>Funds by Country</h2>\
                            <div id="by_country" class="' + countryClass + '"></div>\
                        </div></div>\
                    </div>\
                    <div class="' + sectionClass + '">\
                        <h2>Funding by Continent</h2>\
                        <div class="row"><div class="col-md-12"><div id="by_continent" class="' + continentClass + '"></div></div></div>\
                    </div>\
                    <div class="' + sectionClass + '">\
                        <h2>Top ' + this.topDonorLimit + ' Donors/Members</h2>\
                        <div class="row"><div class="col-md-12"><div id="top_donors" class="' + topDonorsClass + '"></div></div></div>\
                    </div>\
                    <div class="' + sectionClass + '">\
                        <h2>All Donors/Members</h2>\
                        <div class="row"><div class="col-md-10 col-md-offset-1"><div id="all_donors" class="' + allDonorsClass + '"></div></div></div>\
                    </div>\
                </div></div>';

            edge.context.html(frag);
        }
    },

    newDonorList : function(params) {
        return edges.instantiate(scoss.DonorList, params, edges.newComponent);
    },
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
