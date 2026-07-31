sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";
    return Controller.extend("ui5.odata.demo.controller.InvoiceItemList", {
        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
        }
    });
});
