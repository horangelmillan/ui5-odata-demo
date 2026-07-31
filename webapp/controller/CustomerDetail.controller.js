sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("ui5.odata.demo.controller.CustomerDetail", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oRouter.getRoute("customerDetail").attachPatternMatched(
                this._onRouteMatched, this
            );
        },

        _onRouteMatched: function (oEvent) {
            var sCustomerId = oEvent.getParameter("arguments").customerId;
            this.getView().bindElement({
                // N18 (ciclo 13): sintaxis por-key OData v4 con paréntesis.
                path: "/customer-odata('" + sCustomerId + "')",
                parameters: {
                    $expand: {
                        invoices: true
                    }
                }
            });
        },

        onNavBack: function () {
            this.oRouter.navTo("customerList");
        }
    });
});
