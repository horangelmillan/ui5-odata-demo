sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("ui5.odata.demo.controller.SupplierInvoiceDetail", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oRouter.getRoute("supplierInvoiceDetail").attachPatternMatched(
                this._onRouteMatched, this
            );
        },

        _onRouteMatched: function (oEvent) {
            var sSupplierInvoiceId = oEvent.getParameter("arguments").supplierInvoiceId;
            this.getView().bindElement({
                // N18 (ciclo 13): sintaxis por-key OData v4 con paréntesis.
                path: "/supplier-invoice-odata('" + sSupplierInvoiceId + "')",
                parameters: {
                    $expand: {
                        supplier: true,
                        items: {
                            $expand: { glAccount: true }
                        },
                        payments: true
                    }
                }
            });
        },

        onNavBack: function () {
            this.oRouter.navTo("supplierInvoiceList");
        }
    });
});
