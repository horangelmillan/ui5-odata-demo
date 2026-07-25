sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("ui5.odata.demo.controller.InvoiceDetail", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
            this.oRouter.getRoute("invoiceDetail").attachPatternMatched(
                this._onRouteMatched, this
            );
        },

        _onRouteMatched: function (oEvent) {
            var sInvoiceId = oEvent.getParameter("arguments").invoiceId;
            this.getView().bindElement({
                path: "/invoice-odata/" + sInvoiceId,
                parameters: {
                    $expand: {
                        customer: true,
                        company: true,
                        items: {
                            $expand: { glAccount: true }
                        }
                    }
                }
            });
        },

        onNavBack: function () {
            this.oRouter.navTo("invoiceList");
        }
    });
});
