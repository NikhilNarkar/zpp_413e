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

        onInit: function () {
            var oLocalModel = models.createLocalModel();
            this.getView().setModel(oLocalModel, "local");
        },

        onSelectionChange: function () {
            // Batch validation is performed on demand with all four required filters.
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

        _requestBatchDetails: async function (oSelection, sBatch, sMaterial) {
            var aFilters = [
                new Filter("Plant", FilterOperator.EQ, oSelection.plant),
                new Filter("StorageLocation", FilterOperator.EQ, oSelection.fromSloc),
                new Filter("Batch", FilterOperator.EQ, sBatch),
                new Filter("Material", FilterOperator.EQ, sMaterial)
            ];
            var oBinding = this.getView().getModel().bindList("/so_batchs", null, null, aFilters);
            try {
                var aContexts = await oBinding.requestContexts(0, 2);
                return aContexts.map(function (oContext) { return oContext.getObject(); });
            } finally {
                oBinding.destroy();
            }
        },

        onToItemSuggestionSelected: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            var oContext = oItem && oItem.getBindingContext();
            if (oContext) {
                var oLocalModel = this.getView().getModel("local");
                oLocalModel.setProperty("/selection/material", oContext.getProperty("Material"));
                oLocalModel.setProperty("/selection/materialDescription", oContext.getProperty("ProductDescription"));
            }
        },

        onAddBatch: async function () {
            if (this._bAddingBatches) { return; }
            var oView = this.getView();
            var oInput = oView.byId("batchInput");
            var sInput = oInput.getValue().trim();
            var oLocalModel = oView.getModel("local");
            var oSelection = Object.assign({}, oLocalModel.getProperty("/selection"));
            if (!sInput) {
                MessageToast.show("Please enter or scan a batch.");
                return;
            }
            if (!oSelection.plant || !oSelection.fromSloc ||
                    !oSelection.toSalesOrder || !oSelection.toSalesOrderItem) {
                MessageBox.warning("Please select Plant, From Storage Location, To Sales Order and To Sales Order Item before adding batches.");
                return;
            }
            this._bAddingBatches = true;
            oView.setBusy(true);
            try {
                // Resolve material for the current destination item, including manually entered items.
                var oItemBinding = oView.getModel().bindList("/ZI_SALESITEM_VH", null, null, [
                    new Filter("SalesOrder", FilterOperator.EQ, oSelection.toSalesOrder),
                    new Filter("SalesOrderItem", FilterOperator.EQ, oSelection.toSalesOrderItem)
                ], { "$select": "Material,ProductDescription" });
                var oItem;
                try {
                    var aItemContexts = await oItemBinding.requestContexts(0, 1);
                    oItem = aItemContexts.length ? aItemContexts[0].getObject() : null;
                } finally {
                    oItemBinding.destroy();
                }
                if (!oItem || !oItem.Material) {
                    MessageBox.warning("No material found for the selected To Sales Order Item.");
                    return;
                }
                var aScanned = (oLocalModel.getProperty("/scannedBatches") || []).slice();
                var aMessages = [];
                var aFailed = [];
                var iAdded = 0;
                var aBatches = Array.from(new Set(sInput.split(/\s+/)));
                for (var sBatch of aBatches) {
                    if (aScanned.some(function (oBatch) { return oBatch.batch === sBatch; })) {
                        aMessages.push(sBatch + ": Batch already added.");
                        continue;
                    }
                    var aDetails = await this._requestBatchDetails(oSelection, sBatch, oItem.Material);
                    var oDetails = aDetails[0];
                    if (!oDetails || oDetails.Status !== "SUCCESS") {
                        aMessages.push(sBatch + ": " + (oDetails && oDetails.Message || "No batch validation result returned."));
                        aFailed.push(sBatch);
                        continue;
                    }
                    aScanned.push({
                        batch: oDetails.Batch,
                        material: oDetails.Material,
                        description: oDetails.ProductDescription,
                        fromSloc: oSelection.fromSloc,
                        toSloc: oSelection.toSloc,
                        salesOrder: oDetails.SDDocument,
                        salesOrderItem: oDetails.SDDocumentItem,
                        toSalesOrder: oSelection.toSalesOrder,
                        toSalesOrderItem: oSelection.toSalesOrderItem,
                        plant: oDetails.Plant,
                        qty: oDetails.QTY,
                        uom: oDetails.MaterialBaseUnit
                    });
                    iAdded++;
                    aMessages.push(sBatch + ": " + (oDetails.Message || "Batch validated successfully"));
                }
                var oCurrent = oLocalModel.getProperty("/selection");
                if (["plant", "fromSloc", "toSloc", "toSalesOrder", "toSalesOrderItem"].some(function (sKey) {
                    return oCurrent[sKey] !== oSelection[sKey];
                })) {
                    MessageBox.warning("The selection changed while validating. Please add the batches again.");
                    return;
                }
                oLocalModel.setProperty("/selection/material", oItem.Material);
                oLocalModel.setProperty("/selection/materialDescription", oItem.ProductDescription);
                oLocalModel.setProperty("/scannedBatches", aScanned);
                this._calculateTotalYield();
                oInput.setValue(aFailed.join(" "));
                var sMessage = "Added " + iAdded + " batches.\n" + aMessages.join("\n");
                if (aFailed.length || !iAdded) {
                    MessageBox.warning(sMessage);
                } else {
                    MessageToast.show(sMessage);
                }
            } catch (oError) {
                MessageBox.error(oError.message || "Could not validate batches with the backend. Please try again.");
            } finally {
                this._bAddingBatches = false;
                oView.setBusy(false);
                setTimeout(function () { oInput.focus(); }, 100);
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