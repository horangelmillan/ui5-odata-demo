sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("ui5.odata.demo.controller.PaymentList", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
        },

        onFilter: function () {
            var oTable = this.byId("tblPayments");
            if (!oTable) return;
            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            var aFilters = [];
            var sMetodo = this.byId("filterMetodo").getSelectedKey();
            if (sMetodo) {
                aFilters.push(new Filter("metodo", FilterOperator.EQ, sMetodo));
            }
            oBinding.filter(aFilters);
        },

        onClearFilter: function () {
            this.byId("filterMetodo").setSelectedKey("");
            var oTable = this.byId("tblPayments");
            if (!oTable) return;
            var oBinding = oTable.getBinding("rows");
            if (oBinding) oBinding.filter([]);
        },

        onPaymentSelect: function (oEvent) {
            var oCtx = oEvent.getParameter("rowContext");
            if (!oCtx) return;
            var sInvoiceId = oCtx.getProperty("invoice/id");
            if (sInvoiceId) {
                this.oRouter.navTo("invoiceDetail", { invoiceId: sInvoiceId });
            }
        }
    });
});
