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
                    name : "continent",
                    field: "Funder Continent",
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
        var results = false;
        var aggs = component.edge.resources.master_aggregations;
        for (var i = 0; i < aggs.length; i++) {
            if (aggs[i].name === "total_committed") {
                results = aggs[i];
                break;
            }
        }

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
        var results = false;
        var aggs = component.edge.resources.master_aggregations;
        for (var i = 0; i < aggs.length; i++) {
            if (aggs[i].name === "total_paid") {
                results = aggs[i];
                break;
            }
        }

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
    
    continentDF : function(chart) {
        var results = false;
        var aggs = chart.edge.resources.master_aggregations;
        for (var i = 0; i < aggs.length; i++) {
            if (aggs[i].name === "continent") {
                results = aggs[i];
                break;
            }
        }

        var series = {key: "By Continent", values: []};
        for (var i = 0; i < results.terms.length; i++) {
            var term = results.terms[i];
            var continent = term.term;
            var sum = term.aggs[0].sum;
            series.values.push({label: continent, value: sum});
        }

        return [series];
    },

    makeServiceProviderPage : function(params) {
        scoss.activeEdges[params.selector] = edges.newEdge({
            selector: params.selector,
            template: scoss.newServiceProviderPageTemplate(),
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
                        title: "Committed",
                        showXofY: true,
                        xyNumFormat: edges.numFormat({
                            prefix: "&euro;",
                            thousandsSeparator: ","
                        })
                    })
                }),
                edges.loading.newLoadingBar({
                    id : "progress_paid",
                    calculate : scoss.progressPaid,
                    renderer : edges.loading_io.newLoadingIORendererBS3({
                        preset: "circle",
                        title: "Paid",
                        showXofY: true,
                        xyNumFormat: edges.numFormat({
                            prefix: "&euro;",
                            thousandsSeparator: ","
                        })
                    })
                }),
                edges.loading.newLoadingBar({
                    id : "progress_needed",
                    calculate : scoss.progressNeeded,
                    renderer : edges.loading_io.newLoadingIORendererBS3({
                        preset: "circle",
                        title: "Needed",
                        showXofY: true,
                        xyNumFormat: edges.numFormat({
                            prefix: "&euro;",
                            thousandsSeparator: ","
                        })
                    })
                }),
                edges.newPieChart({
                    id : "by_continent",
                    dataFunction: scoss.continentDF,
                    renderer : edges.nvd3.newPieChartRenderer({
                        valueFormat: d3.format(',d'),
                        labelsOutside: true,
                        color: false
                    })
                })
            ]
        })
    },
    
    newServiceProviderPageTemplate : function(params) {
        return edges.instantiate(scoss.ServiceProviderPageTemplate, params, edges.newTemplate)
    },
    ServiceProviderPageTemplate : function(params) {
        this.namespace = "scoss-spp";

        this.draw = function(edge) {
            this.edge = edge;

            var containerClass = edges.css_classes(this.namespace, "container");
            var progressCommittedClass = edges.css_classes(this.namespace, "progress_committed");
            var progressPaidClass = edges.css_classes(this.namespace, "progress_paid");
            var progressNeededClass = edges.css_classes(this.namespace, "progress_needed");
            var countryClass = edges.css_classes(this.namespace, "country");
            var continentClass = edges.css_classes(this.namespace, "continent");
            var topDonorsClass = edges.css_classes(this.namespace, "top-donors");
            var allDonorsClass = edges.css_classes(this.namespace, "all-donors");

            var frag = '<div class="' + containerClass + '">\
                    <div class="row">\
                        <div class="col-md-2 col-md-offset-3"><div id="progress_committed" class="' + progressCommittedClass + '"></div></div>\
                        <div class="col-md-2"><div id="progress_paid" class="' + progressPaidClass + '"></div></div>\
                        <div class="col-md-2"><div id="progress_needed" class="' + progressNeededClass + '"></div></div>\
                    </div>\
                    <div class="row"><div class="col-md-12"><div id="by_country" class="' + countryClass + '"></div></div></div>\
                    <div class="row"><div class="col-md-12"><div id="by_continent" class="' + continentClass + '"></div></div></div>\
                    <div class="row"><div class="col-md-12"><div id="top_donors" class="' + topDonorsClass + '"></div></div></div>\
                    <div class="row"><div class="col-md-12"><div id="all_donors" class="' + allDonorsClass + '"></div></div></div>\
                </div></div>';

            edge.context.html(frag);
        }
    }
};
