sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("ui5.odata.demo.controller.PaymentList", {

        onInit: function () {
            this.oRouter = this.getOwnerComponent().getRouter();
        }
    });
});
