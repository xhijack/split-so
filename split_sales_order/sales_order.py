import json
from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice
import frappe

from datetime import timedelta

from erpnext.controllers.accounts_controller import update_child_qty_rate


@frappe.whitelist()
def split_sales_order(sales_order):
    payload = json.loads(sales_order)
    exists_sales_order = frappe.get_cached_doc('Sales Order', payload['current_sales_order'])

    new_sales_order = frappe.new_doc('Sales Order')
    new_sales_order.customer = payload['customer']
    new_sales_order.sales_partner = payload['sales_partner']
    new_sales_order.company = exists_sales_order.company
    new_sales_order.currency = exists_sales_order.currency
    new_sales_order.delivery_date = exists_sales_order.delivery_date + timedelta(days=30)

    for item in payload['items']:
        new_sales_order.append('items', {
            'item_code': item['item_code'],
            'qty': item['qty'],
            'rate': item['rate'],
            'warehouse': exists_sales_order.set_warehouse
        })

    updated_trans_items = []
    for item in exists_sales_order.items:
        for item2 in payload['items']:
            if item.item_code == item2['item_code']:
                item.qty = item.qty - item2['qty']
                item.rate = item.rate - item2['rate']
                break

        updated_trans_items.append({
            'docname': item.name,
            'name': item.name,
            'item_code': item.item_code,
            'delivery_date': item.delivery_date.isoformat(),
            'conversion_factor': item.conversion_factor,
            'idx': item.idx,
            'uom': item.uom,
            'qty': item.qty,
            'rate': item.rate,
        })

    update_child_qty_rate(payload['parent_type'], json.dumps(updated_trans_items),  payload['current_sales_order'], payload['child_docname'])
    new_sales_order.insert()

    return new_sales_order.name


@frappe.whitelist()
def create_si_by_pay_term(sales_order):
    sales_order = frappe.get_cached_doc('Sales Order', sales_order)
    for item in sales_order.items:
        if item.qty < len(sales_order.payment_schedule) and item.qty % len(sales_order.payment_schedule) != 0:
            frappe.throw('Jumlah Qty kurang dari jumlah pembayaran yang diatur di Payment Schedule')
            return False
        else:
            pass

    for ps in sales_order.payment_schedule:
        # make_sales_invoice(sales_order.name, ps)
        si = make_sales_invoice(sales_order.name)
        si.payment_terms_template = None
        si.payment_schedule = None
        si.due_date = ps.due_date
        for item in si.items:
            item.qty = item.qty / len(sales_order.payment_schedule)
        si.insert()
    frappe.db.commit()
    
    return sales_order.name

      
    #     for item in sales_order.items:
    #         qty = item.qty / len(sales_order.payment_schedule)
    #         new_sales_invoice.append('items', {
    #             'item_code': item.item_code,
    #             'qty': qty,
    #             'rate': item.rate,
    #             'warehouse': item.warehouse,
    #             'sales_order': sales_order.name,
    #         })

    #     new_sales_invoice.insert()
    # frappe.db.commit()
    # return sales_order.name

