sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";
    return Controller.extend("ui5.odata.demo.controller.SupplierInvoiceList", {
        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
        },

        onSupplierInvoiceSelect: function (oEvent) {
            var oCtx = oEvent.getParameter("rowContext");
            if (!oCtx) return;
            this.oRouter.navTo("supplierInvoiceDetail", {
                supplierInvoiceId: oCtx.getProperty("id")
            });
        }
    });
});
