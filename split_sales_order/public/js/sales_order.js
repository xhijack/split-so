
frappe.ui.form.on('Sales Order', {
    refresh: function(frm) {
        if (frm.doc.status !== 'Closed' && flt(frm.doc.per_delivered, 2) < 100 && flt(frm.doc.per_billed, 2) < 100) {
            // Add the "Split Sales Order" button
            frm.add_custom_button(__('Split Sales Order'), function() {
                splitSalesOrder(frm);
            });

            frm.add_custom_button(__('Create SI by Pay. Term'), function() {
                frappe.call({
                    method: "split_sales_order.sales_order.create_si_by_pay_term",
                    args: {
                        'sales_order': frm.doc.name,
                    },
                    callback: (r) => {
                        if (r.message) {
                            frappe.msgprint({
                                message: __('Sales Invoice  Untuk <a href="/app/sales-invoice/view/list?sales_order=' + r.message  + ' "> ' + r.message + '</a> sudah dibuat'),
                                indicator: 'green'
                            });
                        }
                    }
                });
            })
        }
    }
});

function splitSalesOrder(frm) {
    const items = frm.doc.items;
    // let data = frm.doc.items;
    data = items.map((d) => {
		return {
			"docname": d.name,
			"name": d.name,
			"item_code": d.item_code,
            "item_name": d.item_name,
            
			"delivery_date": d.delivery_date,
			"schedule_date": d.schedule_date,
			"conversion_factor": d.conversion_factor,
			"qty": d.qty - (d.billed_amt / d.rate),
			"rate": d.rate,
			"uom": d.uom,
			"fg_item": d.fg_item,
			"fg_item_qty": d.fg_item_qty,
            "billed_amt": d.billed_amt,
            "amount": d.amount - d.billed_amt,

		}
	});
    console.log(data);

	const child_meta = frappe.get_meta(`${frm.doc.doctype} Item`);
    const get_precision = (fieldname) => child_meta.fields.find(f => f.fieldname == fieldname).precision;

    // Create a dialog box
    var dialog = new frappe.ui.Dialog({
        title: 'Split Sales Order',
        size: "extra-large",
        fields: [
            {
				fieldname: "trans_items",
				fieldtype: "Table",
				label: "Existing Items",
				cannot_add_rows: false,
				in_place_edit: true,
				reqd: 1,
				data: data,
				get_data: () => {
					return data;
				},
                
                fields: [
                    {
                        fieldtype:'Link',
                        fieldname:"item_code",
                        options: 'Item',
                        in_list_view: 1,
                        read_only: 0,
                        disabled: 0,
                        label: __('Item Code'),
                        column: 1,
                    },
                    {
                        fieldtype: 'Data',
                        fieldname: 'item_name',
                        label: 'Item Name',
                        in_list_view: 1,
                        in_place_edit: true,
                        column: 1,

                    },
                    {
                        fieldtype:'Float',
                        fieldname:"qty",
                        default: 0,
                        read_only: 0,
                        in_list_view: 1,
                        label: __('Qty'),
                        precision: get_precision("qty"),
                        column: 1,

                    },
                    {
                        fieldtype: 'Currency',
                        fieldname: 'rate',
                        in_list_view: 1,
                        label: 'Rate',
                        in_place_edit: true,
                        column: 2,

                    },
                    {
                        fieldtype: 'Currency',
                        fieldname: 'amount',
                        in_list_view: 1,
                        label: 'Amount',
                        in_place_edit: false,
                        column: 2
                    },
                    // {
                    //     fieldtype: 'Currency',
                    //     fieldname: 'billed_amt',
                    //     in_list_view: 1,
                    //     label: 'Billed Amt',
                    //     in_place_edit: false,
                    //     column: 2,

                    // }
                ],
                
            },
            {
                fieldname: "customer",
				fieldtype: "Link",
				label: "Customer",
                options: "Customer",
                reqd: 1,
            },
            {
                fieldname: "sales_partner",
				fieldtype: "Link",
				label: "Sales Partner",
                options: "Sales Partner",
                reqd: 1,
            },
            {
				fieldname: "new_trans_items",
				fieldtype: "Table",
				label: "New Items For New Sales Order",
				cannot_add_rows: false,
				in_place_edit: true,
				reqd: 1,
				data: data,
				get_data: () => {
					return data;
				},
                
                fields: [
                    {
                        fieldtype:'Link',
                        fieldname:"item_code",
                        options: 'Item',
                        in_list_view: 1,
                        read_only: 0,
                        disabled: 0,
                        label: __('Item Code'),
                    },
                    {
                        fieldtype: 'Data',
                        fieldname: 'item_name',
                        label: 'Item Name',
                        in_list_view: 1,
                        in_place_edit: true,
                    },
                    {
                        fieldtype:'Float',
                        fieldname:"qty",
                        default: 0,
                        read_only: 0,
                        in_list_view: 1,
                        label: __('Qty'),
                        precision: get_precision("qty")
                    },
                    {
                        fieldtype: 'Currency',
                        fieldname: 'rate',
                        in_list_view: 1,
                        label: 'Rate',
                        in_place_edit: true,
                    },
                    {
                        fieldtype: 'Currency',
                        fieldname: 'amount',
                        in_list_view: 1,
                        label: 'Amount',
                        in_place_edit: false,
                    }
                ],
                
            }
        ],
        primary_action_label: 'Create New Sales Order',
        primary_action: function() {
            // Handle save action
            var values = dialog.get_values();

            // Create sales order from values
            var salesOrder = {
                customer: values.customer,
                sales_partner: values.sales_partner,
                items: values.new_trans_items,
                current_sales_order: frm.doc.name,
                parent_type: frm.doc.doctype,
                child_docname: 'items',
            };
            
            frappe.call({
                method: 'split_sales_order.sales_order.split_sales_order',
                args: {
                    'sales_order': salesOrder
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.show_alert({
                            message: __(`<a href="/desk#Form/Sales Order/${r.message}">Sales Order ${r.message} created successfully</a>`),
                            indicator: 'green'
                        });
                    }
                }
            });

            // Process the table data
            console.log(salesOrder);
            dialog.hide();
        }
    });

    // Show the dialog box
    dialog.show();
}
