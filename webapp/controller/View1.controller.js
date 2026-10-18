sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "zpp413e/model/models",     // Updated namespace
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat",
     "sap/ui/export/Spreadsheet",       // <--- ADD THIS
    "sap/ui/export/library"
], function (Controller, Filter, FilterOperator, MessageToast, Fragment, models, MessageBox, DateFormat, Spreadsheet, exportLibrary) { 
    "use strict";

    return Controller.extend("zpp413e.controller.View1", {

        _getBackendErrorMessage: function (oError, sFallback) {
            var aMessages = [];
            function collect(oValue) {
                if (!oValue) { return; }
                if (typeof oValue === "string") {
                    try { collect(JSON.parse(oValue)); } catch (e) {
                        if (aMessages.indexOf(oValue) < 0) { aMessages.push(oValue); }
                    }
                    return;
                }
                if (Array.isArray(oValue)) { oValue.forEach(collect); return; }
                if (oValue.error) { collect(oValue.error); }
                if (oValue.message) { collect(oValue.message); }
                if (oValue.value) { collect(oValue.value); }
                if (oValue.details) { collect(oValue.details); }
                if (oValue.innererror) { collect(oValue.innererror); }
                if (oValue.errordetails) { collect(oValue.errordetails); }
            }
            collect(oError && (oError.responseText || (oError.response && oError.response.body)));
            if (!aMessages.length) { collect(oError); }
            return aMessages.join("\n") || sFallback;
        },

        onInit: function () {
            var oLocalModel = models.createLocalModel();
            this.getView().setModel(oLocalModel, "local");
        },

        onSelectionChange: function () {
            // Validate each batch against the backend when scanned.
        },

        // ==========================================
        // 1. SUGGEST LOGIC (Type-ahead)
        // ==========================================
        onSalesOrderSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [];

            if (!sPlant) {
                MessageToast.show("Please select a Plant first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            if (sTerm) {
                aFilters.push(new Filter("SalesOrder", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        onSalesOrderItemSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sSalesOrder = this.getView().byId("inputSalesOrder").getValue();
            var aFilters = [];

            if (!sSalesOrder) {
                MessageToast.show("Please select a Sales Order first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder));
            if (sTerm) {
                aFilters.push(new Filter("SalesOrderItem", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        // ==========================================
        // 2. VALUE HELP DIALOG LOGIC (F4 Pop-ups)
        // ==========================================
        
        // --- PLANT ---
        onPlantValueHelp: function (oEvent) {
            var oView = this.getView();
            if (!this._oPlantDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.PlantVH", 
                    controller: this
                }).then(function (oDialog) {
                    this._oPlantDialog = oDialog;
                    oView.addDependent(this._oPlantDialog);
                    this._oPlantDialog.open();
                }.bind(this));
            } else {
                this._oPlantDialog.open();
            }
        },

        onPlantVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                this.getView().byId("inputPlant").setValue(oSelectedItem.getTitle());
                this.getView().byId("inputSalesOrder").setValue("");
                this.getView().byId("inputSalesOrderItem").setValue("");
                
                // Also clear the 'To' fields if Plant changes
                this.getView().byId("inputToSalesOrder").setValue("");
                this.getView().byId("inputToSalesOrderItem").setValue("");

                this.onSelectionChange();
            }
        },

        onPlantVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var aFilters = [];
            if (sValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Plant", FilterOperator.Contains, sValue),
                        new Filter("PlantName", FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        // --- SALES ORDER ---
        onSalesOrderValueHelp: function (oEvent) {
            var oView = this.getView();
            var sPlant = oView.byId("inputPlant").getValue();

            if (!sPlant) {
                MessageToast.show("Please select a Plant first");
                return;
            }

            if (!this._oSalesOrderDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.SalesOrderVH",
                    controller: this
                }).then(function (oDialog) {
                    this._oSalesOrderDialog = oDialog;
                    oView.addDependent(this._oSalesOrderDialog);
                    var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                    this._oSalesOrderDialog.getBinding("items").filter([oFilter]);
                    this._oSalesOrderDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                this._oSalesOrderDialog.getBinding("items").filter([oFilter]);
                this._oSalesOrderDialog.open();
            }
        },

        onSalesOrderVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

            if (sValue) {
                aFilters.push(new Filter("SalesOrder", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onSalesOrderVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSalesOrder = oSelectedItem.getCells()[0].getText();
                this.getView().byId("inputSalesOrder").setValue(sSalesOrder);
                this.getView().byId("inputSalesOrderItem").setValue("");
                
                this.onSelectionChange();
            }
        },

        // --- SALES ORDER ITEM ---
        onSalesOrderItemValueHelp: function (oEvent) {
            var oView = this.getView();
            var sSalesOrder = oView.byId("inputSalesOrder").getValue();

            if (!sSalesOrder) {
                MessageToast.show("Please select a Sales Order first");
                return;
            }

            if (!this._oItemDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.SalesOrderItemVH",
                    controller: this
                }).then(function (oDialog) {
                    this._oItemDialog = oDialog;
                    oView.addDependent(this._oItemDialog);
                    var oFilter = new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder);
                    this._oItemDialog.getBinding("items").filter([oFilter]);
                    this._oItemDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder);
                this._oItemDialog.getBinding("items").filter([oFilter]);
                this._oItemDialog.open();
            }
        },

           onSalesOrderItemChange: function () {
            var oView = this.getView();
            var oLocalModel = oView.getModel("local");
            var oODataModel = oView.getModel(); 
            
            // Read directly from the model instead of oEvent.getSource()
            var sItemValue = oLocalModel.getProperty("/selection/salesOrderItem");
            var sSalesOrder = oLocalModel.getProperty("/selection/salesOrder");

            if (!sItemValue) {
                oLocalModel.setProperty("/selection/material", "");
                oLocalModel.setProperty("/selection/materialDescription", "");
                return;
            }

            var sPaddedItem = sItemValue.trim().padStart(6, '0');
            var sPaddedOrder = (sSalesOrder || "").trim().padStart(10, '0');
            
            if (!sPaddedOrder || sPaddedOrder === "0000000000") {
                sap.m.MessageBox.error("Please enter a valid Sales Order before specifying an item.");
                return;
            }

            var sContextPath = "/ZI_SALESITEM_VH(SalesOrder='" + sPaddedOrder + "',SalesOrderItem='" + sPaddedItem + "')";
            
            oView.setBusy(true);

            var oContextBinding = oODataModel.bindContext(sContextPath);

            oContextBinding.requestObject().then(function (oData) {
                oView.setBusy(false);

                if (oData) {
                    // Make sure 'Material' and 'ProductDescription' perfectly match your CDS view fields!
                    oLocalModel.setProperty("/selection/material", oData.Material);
                    oLocalModel.setProperty("/selection/materialDescription", oData.ProductDescription);
                }
            }).catch(function (oError) {
                oView.setBusy(false);
                
                oLocalModel.setProperty("/selection/material", "");
                oLocalModel.setProperty("/selection/materialDescription", "");
                
                sap.m.MessageToast.show("Invalid item specified for this Sales Order.");
            });
        },

        onItemVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sSalesOrder = this.getView().byId("inputSalesOrder").getValue();
            var aFilters = [new Filter("SalesOrder", FilterOperator.EQ, sSalesOrder)];

            if (sValue) {
                aFilters.push(new Filter("SalesOrderItem", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onItemVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSalesOrderItem = oSelectedItem.getCells()[0].getText();
                this.getView().byId("inputSalesOrderItem").setValue(sSalesOrderItem);
                
                this.onSelectionChange();
            }
        },

        // // --- TO SALES ORDER (NEW) ---
        onToSalesOrderValueHelp: function (oEvent) {
            var oView = this.getView();
            var sPlant = oView.byId("inputPlant").getValue();

            if (!sPlant) {
                MessageToast.show("Please select a Plant first");
                return;
            }

            if (!this._oToSalesOrderDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.ToSalesOrderVH", // Ensure this fragment exists
                    controller: this
                }).then(function (oDialog) {
                    this._oToSalesOrderDialog = oDialog;
                    oView.addDependent(this._oToSalesOrderDialog);
                    var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                    this._oToSalesOrderDialog.getBinding("items").filter([oFilter]);
                    this._oToSalesOrderDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                this._oToSalesOrderDialog.getBinding("items").filter([oFilter]);
                this._oToSalesOrderDialog.open();
            }
        },

        onToSalesOrderVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

            if (sValue) {
                aFilters.push(new Filter("SalesOrder", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onToSalesOrderVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSalesOrder = oSelectedItem.getCells()[0].getText();
                this.getView().byId("inputToSalesOrder").setValue(sSalesOrder);
                this.getView().byId("inputToSalesOrderItem").setValue(""); // Clear item when header changes
            }
        },

        onToSalesOrderSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [];

            if (!sPlant) {
                MessageToast.show("Please select a Plant first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            if (sTerm) {
                aFilters.push(new Filter("SalesOrder", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        // --- TO SALES ORDER ITEM (NEW) ---
        onToSalesOrderItemValueHelp: function (oEvent) {
            var oView = this.getView();
            var sToSalesOrder = oView.byId("inputToSalesOrder").getValue();

            if (!sToSalesOrder) {
                MessageToast.show("Please select a 'To Sales Order' first");
                return;
            }

            if (!this._oToItemDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.ToSalesOrderItemVH", // Ensure this fragment exists
                    controller: this
                }).then(function (oDialog) {
                    this._oToItemDialog = oDialog;
                    oView.addDependent(this._oToItemDialog);
                    var oFilter = new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder);
                    this._oToItemDialog.getBinding("items").filter([oFilter]);
                    this._oToItemDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder);
                this._oToItemDialog.getBinding("items").filter([oFilter]);
                this._oToItemDialog.open();
            }
        },

        onToItemVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sToSalesOrder = this.getView().byId("inputToSalesOrder").getValue();
            var aFilters = [new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder)];

            if (sValue) {
                aFilters.push(new Filter("SalesOrderItem", FilterOperator.Contains, sValue));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onToItemVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSalesOrderItem = oSelectedItem.getCells()[0].getText();
                this.getView().byId("inputToSalesOrderItem").setValue(sSalesOrderItem);
            }
        },

        onToSalesOrderItemSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sToSalesOrder = this.getView().byId("inputToSalesOrder").getValue();
            var aFilters = [];

            if (!sToSalesOrder) {
                MessageToast.show("Please select a 'To Sales Order' first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder));
            if (sTerm) {
                aFilters.push(new Filter("SalesOrderItem", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        // ==========================================
        // FROM STORAGE LOCATION LOGIC
        // ==========================================
        onFromSlocSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [];

            if (!sPlant) {
                sap.m.MessageToast.show("Please select a Plant first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            if (sTerm) {
                aFilters.push(new Filter("StorageLocation", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        onFromSlocValueHelp: function (oEvent) {
            var oView = this.getView();
            var sPlant = oView.byId("inputPlant").getValue();

            if (!sPlant) {
                sap.m.MessageToast.show("Please select a Plant first");
                return;
            }

            if (!this._oFromSlocDialog) {
                sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.FromSlocVH", // Ensure this fragment is created
                    controller: this
                }).then(function (oDialog) {
                    this._oFromSlocDialog = oDialog;
                    oView.addDependent(this._oFromSlocDialog);
                    var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                    this._oFromSlocDialog.getBinding("items").filter([oFilter]);
                    this._oFromSlocDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                this._oFromSlocDialog.getBinding("items").filter([oFilter]);
                this._oFromSlocDialog.open();
            }
        },

        onFromSlocVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

            if (sValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("StorageLocation", FilterOperator.Contains, sValue),
                        new Filter("StorageLocationName", FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onFromSlocVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSloc = oSelectedItem.getCells()[1].getText();
                this.getView().byId("inputFromSloc").setValue(sSloc);
                
                // Trigger the background fetch since From Sloc changed
                this.onSelectionChange(); 
            }
        },

        // ==========================================
        // TO STORAGE LOCATION LOGIC
        // ==========================================
        onToSlocSuggest: function (oEvent) {
            var sTerm = oEvent.getParameter("suggestValue");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [];

            if (!sPlant) {
                sap.m.MessageToast.show("Please select a Plant first");
                oEvent.getSource().getBinding("suggestionItems").filter([]);
                return;
            }

            aFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
            if (sTerm) {
                aFilters.push(new Filter("StorageLocation", FilterOperator.StartsWith, sTerm));
            }
            oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
        },

        onToSlocValueHelp: function (oEvent) {
            var oView = this.getView();
            var sPlant = oView.byId("inputPlant").getValue();

            if (!sPlant) {
                sap.m.MessageToast.show("Please select a Plant first");
                return;
            }

            if (!this._oToSlocDialog) {
                sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "zpp413e.view.ToSlocVH", // Ensure this fragment is created
                    controller: this
                }).then(function (oDialog) {
                    this._oToSlocDialog = oDialog;
                    oView.addDependent(this._oToSlocDialog);
                    var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                    this._oToSlocDialog.getBinding("items").filter([oFilter]);
                    this._oToSlocDialog.open();
                }.bind(this));
            } else {
                var oFilter = new Filter("Plant", FilterOperator.EQ, sPlant);
                this._oToSlocDialog.getBinding("items").filter([oFilter]);
                this._oToSlocDialog.open();
            }
        },

        onToSlocVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var sPlant = this.getView().byId("inputPlant").getValue();
            var aFilters = [new Filter("Plant", FilterOperator.EQ, sPlant)];

            if (sValue) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("StorageLocation", FilterOperator.Contains, sValue),
                        new Filter("StorageLocationName", FilterOperator.Contains, sValue)
                    ],
                    and: false
                }));
            }
            oEvent.getSource().getBinding("items").filter(aFilters);
        },

        onToSlocVHConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sSloc = oSelectedItem.getCells()[1].getText();
                this.getView().byId("inputToSloc").setValue(sSloc);
            }
        },

        // ==========================================
        // VALIDATE AND ADD SCANNED BATCHES VIA ODATA V4
        // ==========================================
        onAddBatch: async function () {
            var oView = this.getView();
            var oInput = oView.byId("batchInput");
            var oLocalModel = oView.getModel("local");
            var oODataModel = oView.getModel();
            var sInputValue = (oInput.getValue() || "").trim();

            var fnRetainFocus = function () {
                setTimeout(function () { oInput.focus(); }, 100);
            };

            if (this._bAddingBatches) { return; }
            if (!sInputValue) {
                MessageToast.show("Please enter or scan a batch.");
                fnRetainFocus();
                return;
            }

            var oSelection = oLocalModel.getProperty("/selection") || {};
            var sPlant = oView.byId("inputPlant").getValue().trim();
            var sFromSloc = oView.byId("inputFromSloc").getValue().trim();
            var sMaterial;
            var sToSloc = oSelection.toSloc || "";
            var sToSalesOrder = oView.byId("inputToSalesOrder").getValue().trim();
            var sToSalesOrderItem = oView.byId("inputToSalesOrderItem").getValue().trim();

            if (!sPlant || !sFromSloc || !sToSalesOrder || !sToSalesOrderItem) {
                var aMissing = [];
                if (!sPlant) { aMissing.push("Plant"); }
                if (!sFromSloc) { aMissing.push("From Storage Location"); }
                if (!sToSalesOrder) { aMissing.push("To Sales Order"); }
                if (!sToSalesOrderItem) { aMissing.push("To Sales Order Item"); }
                MessageBox.warning("Please enter: " + aMissing.join(", ") + ".");
                fnRetainFocus();
                return;
            }

            // Keep the original support for multiple batch numbers per input.
            var aInputBatches = Array.from(new Set(sInputValue.split(/\s+/).filter(Boolean)));
            var aScanned = (oLocalModel.getProperty("/scannedBatches") || []).slice();
            var aErrors = [];
            var iAddedCount = 0;

            this._bAddingBatches = true;
            oView.setBusy(true);

            try {
                // Resolve material from the current item even when it was typed manually
                // or selected before the scanner handler was loaded.
                var oItemBinding;
                try {
                    oItemBinding = oODataModel.bindList("/ZI_SALESITEM_VH", null, null, [
                        new Filter("SalesOrder", FilterOperator.EQ, sToSalesOrder.padStart(10, "0")),
                        new Filter("SalesOrderItem", FilterOperator.EQ, sToSalesOrderItem.padStart(6, "0"))
                    ], { "$select": "SalesOrder,SalesOrderItem,Material,ProductDescription" });
                    var aItemContexts = await oItemBinding.requestContexts(0, 2);
                    if (aItemContexts.length !== 1) {
                        MessageBox.error("Could not find a unique material for the selected Sales Order Item.");
                        return;
                    }
                    var oItemData = aItemContexts[0].getObject();
                    sMaterial = String(oItemData.Material || "").trim();
                    if (!sMaterial) {
                        MessageBox.error("The backend returned no Material for the selected Sales Order Item.");
                        return;
                    }
                    oLocalModel.setProperty("/selection/material", sMaterial);
                    oLocalModel.setProperty("/selection/materialDescription", oItemData.ProductDescription || "");
                } catch (oItemError) {
                    MessageBox.error(this._getBackendErrorMessage(oItemError, "Could not load the Sales Order Item material."));
                    return;
                } finally {
                    if (oItemBinding) { oItemBinding.destroy(); }
                }
                for (var sBatch of aInputBatches) {
                    if (aScanned.some(function (oItem) { return oItem.batch === sBatch; })) {
                        aErrors.push(sBatch + ": Batch already added.");
                        continue;
                    }

                    var aFilters = [
                        new Filter("Plant", FilterOperator.EQ, sPlant),
                        new Filter("StorageLocation", FilterOperator.EQ, sFromSloc),
                        new Filter("Batch", FilterOperator.EQ, sBatch),
                        new Filter("Material", FilterOperator.EQ, sMaterial)
                    ];
                    var oListBinding;
                    try {
                        // Request all exposed fields, including backend validation messages.
                        oListBinding = oODataModel.bindList("/so_batchs", null, null, aFilters);
                        var aContexts = await oListBinding.requestContexts(0, 2);
                        if (aContexts.length === 0) {
                            aErrors.push(sBatch + ": No result returned by backend.");
                            continue;
                        }
                        if (aContexts.length > 1) {
                            aErrors.push(sBatch + ": Multiple records returned; cannot choose a unique batch.");
                            continue;
                        }

                        var oData = aContexts[0].getObject();
                        var sStatus = String(oData.Status || "").trim().toUpperCase();
                        var sMessageType = String(oData.MessageType || "").trim().toUpperCase();
                        var sBackendMessage = oData.Message || "Backend batch validation failed.";

                        if (sStatus === "ERROR" || sMessageType === "E" || sMessageType === "A" || sMessageType === "X") {
                            aErrors.push(sBatch + ": " + sBackendMessage);
                            continue;
                        }
                        // Older service versions return batch data without validation status fields.
                        if ((sStatus || sMessageType) && sStatus !== "SUCCESS" && sMessageType !== "S") {
                            aErrors.push(sBatch + ": " + sBackendMessage);
                            continue;
                        }
                        if (oData.Batch !== sBatch || oData.Material !== sMaterial ||
                            oData.Plant !== sPlant || oData.StorageLocation !== sFromSloc) {
                            aErrors.push(sBatch + ": Backend returned mismatched batch details.");
                            continue;
                        }
                        if (!(Number(oData.QTY) > 0)) {
                            aErrors.push(sBatch + ": " + (oData.Message || "No available quantity."));
                            continue;
                        }

                        aScanned.push({
                            batch: oData.Batch,
                            material: oData.Material,
                            description: oData.ProductDescription,
                            fromSloc: sFromSloc,
                            toSloc: sToSloc,
                            salesOrder: oData.SDDocument,
                            salesOrderItem: oData.SDDocumentItem,
                            toSalesOrder: sToSalesOrder,
                            toSalesOrderItem: sToSalesOrderItem,
                            plant: oData.Plant,
                            qty: oData.QTY,
                            uom: oData.MaterialBaseUnit
                        });
                        iAddedCount++;
                    } catch (oError) {
                        aErrors.push(sBatch + ": " + this._getBackendErrorMessage(oError, "Batch service call failed."));
                    } finally {
                        if (oListBinding) { oListBinding.destroy(); }
                    }
                }

                // Protect against changes to selection while requests are running.
                var oCurrent = oLocalModel.getProperty("/selection") || {};
                if (oView.byId("inputPlant").getValue().trim() !== sPlant ||
                    oView.byId("inputFromSloc").getValue().trim() !== sFromSloc ||
                    oCurrent.material !== sMaterial || oCurrent.toSloc !== sToSloc ||
                    oView.byId("inputToSalesOrder").getValue().trim() !== sToSalesOrder ||
                    oView.byId("inputToSalesOrderItem").getValue().trim() !== sToSalesOrderItem) {
                    MessageBox.warning("Selection changed during scanning. Please scan again.");
                    return;
                }

                if (iAddedCount > 0) {
                    oLocalModel.setProperty("/scannedBatches", aScanned);
                    this._calculateTotalYield();
                }
                if (aErrors.length > 0) {
                    var sMessage = (iAddedCount ? iAddedCount + " batch(es) added successfully.\n\n" : "") + aErrors.join("\n");
                    MessageBox.warning(sMessage);
                } else if (iAddedCount > 0) {
                    MessageToast.show(iAddedCount + " batch(es) added successfully.");
                }
            } finally {
                this._bAddingBatches = false;
                oView.setBusy(false);
                oInput.setValue("");
                fnRetainFocus();
            }
        },

        // ==========================================
        // DELETE SELECTED BATCHES
        // ==========================================
        onDeleteBatch: function (oEvent) {
            var oView = this.getView();
            var oTable = oView.byId("batchesTable");
            var oLocalModel = oView.getModel("local");

            var aSelectedContexts = oTable.getSelectedContexts();

            if (aSelectedContexts.length === 0) {
                sap.m.MessageToast.show("Please select at least one batch to delete.");
                return;
            }

            var aScannedBatches = oLocalModel.getProperty("/scannedBatches") || [];

            var aSelectedObjects = aSelectedContexts.map(function (oContext) {
                return oContext.getObject();
            });

            var aRemainingBatches = aScannedBatches.filter(function (oBatch) {
                return aSelectedObjects.indexOf(oBatch) === -1;
            });

            oLocalModel.setProperty("/scannedBatches", aRemainingBatches);
            oTable.removeSelections(true);

            this._calculateTotalYield();
            sap.m.MessageToast.show(aSelectedContexts.length + " batches deleted.");
        },

        _calculateTotalYield: function () {
            var oLocalModel = this.getView().getModel("local");
            var aScannedBatches = oLocalModel.getProperty("/scannedBatches") || [];
            var fTotalQty = 0;

            // Loop through all scanned batches and sum the quantity
            aScannedBatches.forEach(function (oBatch) {
                // Parse float to ensure mathematical addition, not string concatenation
                fTotalQty += parseFloat(oBatch.qty) || 0; 
            });

            // Set the total back to the model, rounded to 2 decimal places (optional)
            oLocalModel.setProperty("/selection/yieldQty", fTotalQty.toFixed(3));
        },

        // ==========================================
        // FOOTER BUTTON ACTIONS
        // ==========================================
        onNew: function () {
            var oLocalModel = this.getView().getModel("local");
            
            oLocalModel.setProperty("/scannedBatches", []);
            oLocalModel.setProperty("/selection/plant", "");
            // oLocalModel.setProperty("/selection/salesOrder", "");
            // oLocalModel.setProperty("/selection/salesOrderItem", "");
            oLocalModel.setProperty("/selection/material", "");
            oLocalModel.setProperty("/selection/materialDescription", "");
            oLocalModel.setProperty("/selection/fromSloc", "");
            oLocalModel.setProperty("/selection/toSloc", "");
            oLocalModel.setProperty("/selection/toSalesOrder", "");
            oLocalModel.setProperty("/selection/toSalesOrderItem", "");
            
            sap.m.MessageToast.show("Screen cleared for new entry.");
        },

        // ==========================================
        // SUBMIT TO BACKEND
        // ==========================================
        onSubmit: function () {
            var oView = this.getView();
            var oLocalModel = oView.getModel("local");
            var oODataModel = oView.getModel();

            var oSelection = oLocalModel.getProperty("/selection");
            var aScannedBatches = oLocalModel.getProperty("/scannedBatches") || [];

            // if (!oSelection.plant || !oSelection.fromSloc || !oSelection.toSloc || !oSelection.postingDate) {
                
            //     MessageBox.error("Please fill in all mandatory details before submitting.");
            //     return;
            // }

            // if (aScannedBatches.length === 0) {
            //     MessageBox.error("Please scan at least one batch into the table.");
            //     return;
            // }

            if (!oSelection.plant || !oSelection.fromSloc || !oSelection.toSloc || !oSelection.postingDate ||
    !oSelection.toSalesOrder || !oSelection.toSalesOrderItem) {
    MessageBox.error("Please fill in all mandatory details before submitting.");
    return;
}

if (aScannedBatches.length === 0) {
    MessageBox.error("Please scan at least one batch into the table.");
    return;
}

var bInvalidItem = aScannedBatches.some(function (oBatch) {
    return !oBatch.salesOrder || !oBatch.salesOrderItem;
});

if (bInvalidItem) {
    MessageBox.error("Each line item must have Sales Order and Sales Order Item.");
    return;
}

            var oDateFormat = DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
            var sFormattedDate = oDateFormat.format(oSelection.postingDate);
            // var sSalesOrder = oSelection.salesOrder.padStart(10, '0');
            // var sSalesOrderItem = oSelection.salesOrderItem.padStart(6, '0');
            
            // Format To fields
            var sToSalesOrder = oSelection.toSalesOrder ? oSelection.toSalesOrder.padStart(10, '0') : "";
            var sToSalesOrderItem = oSelection.toSalesOrderItem ? oSelection.toSalesOrderItem.padStart(6, '0') : "";

            // Mapping exact requested payload shape
            var aItemsPayload = aScannedBatches.map(function(oBatch) {
                return {
                    "Material": oBatch.material,
                    "Qty": String(oBatch.qty), 
                    "Unit": oBatch.uom,
                    "Batch": oBatch.batch,
                    "SalesOrder": (oBatch.salesOrder || "").trim().padStart(10, "0"),
                    "SalesOrderItem": (oBatch.salesOrderItem || "").trim().padStart(6, "0"),
                    "ToSalesOrder": (oBatch.toSalesOrder || "").trim().padStart(10, "0"),
                    "ToSalesOrderItem": (oBatch.toSalesOrderItem || "").trim().padStart(6, "0")

                    // "ToBatch": oBatch.batchTransfer || ""
                };
            });

            var oPayload = {
                "Plant": oSelection.plant,
                "PostingDate": sFormattedDate,
                "StorlocFrom": oSelection.fromSloc,
                "StorlocTo": oSelection.toSloc,
                "Remark": oSelection.remark || "",
                "_Item": aItemsPayload
            };

            oView.setBusy(true);

            // Updated endpoint to map to the exposed entity from ZSD_413E_HD
            var oListBinding = oODataModel.bindList("/ZC_413E_HD");
            var oContext = oListBinding.create(oPayload);

            oContext.created().then(function () {
                oView.setBusy(false);
                
                var sMatDoc = oContext.getProperty("MatDoc");
                var sMess = oContext.getProperty("Mess"); 
                
                if (sMatDoc && sMatDoc.trim() !== "") {
                    var sMessage = "Material Document " + sMatDoc + " created successfully!";
                    MessageBox.success(sMessage, {
                        onClose: function() {
                            oLocalModel.setProperty("/scannedBatches", []);
                            oLocalModel.setProperty("/selection/plant", "");
                            oLocalModel.setProperty("/selection/salesOrder", "");
                            oLocalModel.setProperty("/selection/salesOrderItem", "");
                            oLocalModel.setProperty("/selection/material", "");
                             oLocalModel.setProperty("/selection/materialDescription", "");
                             oLocalModel.setProperty("/selection/fromSloc", "");
            oLocalModel.setProperty("/selection/toSloc", "");
                            oLocalModel.setProperty("/selection/toSalesOrder", "");
                            oLocalModel.setProperty("/selection/toSalesOrderItem", "");
                            oLocalModel.setProperty("/selection/remark", "");
                            
                            var oPlantInput = oView.byId("inputPlant");
                            if (oPlantInput) {
                                oPlantInput.focus(); 
                            }
                        }
                    });
                } else {
                    var sBackendError = sMess ? sMess : "Backend failed to generate a Material Document.";
                    MessageBox.error("SAP Business Error: \n\n" + sBackendError);
                }

            }).catch(function (oError) {
                oView.setBusy(false);
                var sErrorMsg = "Failed to post Material Document due to a network/server error.";
                if (oError && oError.message) {
                    sErrorMsg = oError.message;
                }
                MessageBox.error(sErrorMsg);
            });
        },

        // ==========================================
        // EXPORT TO EXCEL LOGIC
        // ==========================================
        onExportExcel: function () {
            var oView = this.getView();
            var oLocalModel = oView.getModel("local");
            var aScannedBatches = oLocalModel.getProperty("/scannedBatches");

            // 1. Check if there is actually data to export
            if (!aScannedBatches || aScannedBatches.length === 0) {
                sap.m.MessageToast.show("There are no scanned batches to export.");
                return;
            }

            // 2. Fetch the column configuration
            var aCols = this._createColumnConfig();

            // 3. Configure the Excel document settings
            var oSettings = {
                workbook: {
                    columns: aCols,
                    hierarchyLevel: 'Level'
                },
                dataSource: aScannedBatches,      // Feed it our local JSON array
                fileName: 'Scanned_Batches.xlsx', // Name of the downloaded file
                worker: false                     // Set to false for local JSON data
            };

            // 4. Build and download the spreadsheet
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function() {
                oSheet.destroy();
            });
        },

        // Helper function to define Excel columns
        _createColumnConfig: function () {
            var EdmType = exportLibrary.EdmType;

            return [
                {
                    label: 'Material',
                    property: 'material',
                    type: EdmType.String
                },
                {
                    label: 'Batch Number',
                    property: 'batch',
                    type: EdmType.String
                },
                {
                    label: 'Description',
                    property: 'description',
                    type: EdmType.String
                },
                {
                    label: "From Storage Location",
                    property: 'fromSloc',
                    type: EdmType.String
                },
                {
                    label: "To Storage Location",
                    property: 'toSloc',
                    type: EdmType.String
                },
                {
                    label: "Sales Order",
                    property: 'salesOrder',
                    type: EdmType.String
                },
                {
                    label: "Sales Order Item",
                    property: 'salesOrderItem',
                    type: EdmType.String
                },
                {
                    label: 'Quantity',
                    property: 'qty',
                    type: EdmType.Number
                },
                {
                    label: 'Unit of Measure',
                    property: 'uom',
                    type: EdmType.String
                }
            ];
        },
    });
});
