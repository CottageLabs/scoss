var scoss = {
    activeEdges : {},
    
    preSelectServiceProvider : function (args) {
        var service_id = args.service_id;

        return function(params) {
            var resource = params.resource;
            resource.add_filter({filter: {field: "Service ID", value: service_id, type: "exact"}});
        }
    },
    
    continentDF : function(chart) {
        var resource = chart.edge.resources.master_data;

        var aggs = [
            edges.csv.newTermsAggregation({
                name : "continent",
                field: "Funder Continent",
                nested : [
                    edges.csv.newSumAggregation({
                        name: "total",
                        field: "Funding Committed (EUR)"
                    })
                ]
            })
        ];

        var results = resource.applyAggregations({aggs: aggs})[0];

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
                    datatype : "text"
                },
                {
                    id : "master_data",
                    url : params.master_data,
                    processor : edges.csv.newObjectByRow,
                    datatype : "text",
                    opening: scoss.preSelectServiceProvider({service_id: params.service_id})
                }
            ],
            components : [
                edges.newPieChart({
                    id : "by_continent",
                    dataFunction: scoss.continentDF,
                    renderer : edges.nvd3.newPieChartRenderer({
                        valueFormat: d3.format(',d'),
                        donut: true,
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
            var progressClass = edges.css_classes(this.namespace, "progress");
            var countryClass = edges.css_classes(this.namespace, "country");
            var continentClass = edges.css_classes(this.namespace, "continent");
            var topDonorsClass = edges.css_classes(this.namespace, "top-donors");
            var allDonorsClass = edges.css_classes(this.namespace, "all-donors");

            var frag = '<div class="' + containerClass + '"><div class="row">\
                    <div class="col-md-12"><div id="progress" class="' + progressClass + '"></div></div>\
                    <div class="col-md-12"><div id="by_country" class="' + countryClass + '"></div></div>\
                    <div class="col-md-12"><div id="by_continent" class="' + continentClass + '"></div></div>\
                    <div class="col-md-12"><div id="top_donors" class="' + topDonorsClass + '"></div></div>\
                    <div class="col-md-12"><div id="all_donors" class="' + allDonorsClass + '"></div></div>\
                </div></div>';

            edge.context.html(frag);
        }
    }
};
