System.register(["../Vendor/Vue/vue.js", "./Grid.js"], function (exports_1, context_1) {
    "use strict";
    var vue_js_1, Grid_js_1;
    var __moduleName = context_1 && context_1.id;
    function OfType() {
        return vue_js_1.defineComponent({
            name: 'GridColumn',
            props: {
                title: {
                    type: String,
                    default: ''
                },
                property: {
                    type: String,
                    default: ''
                },
                sortExpression: {
                    type: String,
                    default: ''
                }
            },
            setup: function () {
                return {
                    gridContext: vue_js_1.inject('gridContext'),
                    rowContext: vue_js_1.inject('rowContext')
                };
            },
            computed: {
                mySortExpression: function () {
                    return this.sortExpression || this.property;
                },
                sortProperty: function () {
                    return this.gridContext.sortProperty;
                },
                isCurrentlySorted: function () {
                    return !!this.mySortExpression && this.sortProperty.Property === this.mySortExpression;
                },
                isCurrentlySortedDesc: function () {
                    return this.isCurrentlySorted && this.sortProperty.Direction === Grid_js_1.SortDirection.Descending;
                },
                isCurrentlySortedAsc: function () {
                    return this.isCurrentlySorted && this.sortProperty.Direction === Grid_js_1.SortDirection.Ascending;
                }
            },
            methods: {
                onHeaderClick: function () {
                    this.$emit('click:header', this.property);
                    if (this.mySortExpression) {
                        if (this.isCurrentlySortedAsc) {
                            this.sortProperty.Direction = Grid_js_1.SortDirection.Descending;
                        }
                        else {
                            this.sortProperty.Property = this.mySortExpression;
                            this.sortProperty.Direction = Grid_js_1.SortDirection.Ascending;
                        }
                    }
                },
            },
            template: "\n<th\n    v-if=\"rowContext.isHeader\"\n    scope=\"col\"\n    @click=\"onHeaderClick\"\n    :class=\"isCurrentlySortedAsc ? 'ascending' : isCurrentlySortedDesc ? 'descending' : ''\">\n    <a v-if=\"mySortExpression\" href=\"javascript:void(0);\">\n        <slot name=\"header\">\n            {{title}}\n        </slot>\n    </a>\n    <template v-else>\n        <slot name=\"header\">\n            {{title}}\n        </slot>\n    </template>\n</th>\n<td v-else class=\"grid-select-cell\">\n    <slot>\n        {{rowContext.rowData[property]}}\n    </slot>\n</td>"
        });
    }
    exports_1("default", OfType);
    return {
        setters: [
            function (vue_js_1_1) {
                vue_js_1 = vue_js_1_1;
            },
            function (Grid_js_1_1) {
                Grid_js_1 = Grid_js_1_1;
            }
        ],
        execute: function () {
        }
    };
});
//# sourceMappingURL=GridColumn.js.map