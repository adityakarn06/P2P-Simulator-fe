import type { ReactNode } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/common/money";
import { formatDate } from "@/lib/formatters";
import type { Invoice } from "@/types/models";

interface InvoiceExtractedFieldsProps {
  invoice: Invoice;
}

/** Shared tooltip for the two document-claim fields, per backend-docs/invoices-api.md. */
const RAW_FIELD_TITLE =
  "What the document claims — not reconciled against the purchase order.";

function FromInvoiceBadge() {
  return (
    <Badge variant="outline" title={RAW_FIELD_TITLE} className="text-[9px] font-normal">
      From invoice
    </Badge>
  );
}

function Field({
  label,
  value,
  raw = false,
}: {
  label: string;
  value: ReactNode;
  raw?: boolean;
}) {
  return (
    <div className="space-y-0.5" title={raw ? RAW_FIELD_TITLE : undefined}>
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        {raw && <FromInvoiceBadge />}
      </div>
      <p className="text-sm font-medium">
        {value ?? <span className="font-normal text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

/**
 * Renders the fields and line items the invoice worker extracted from the
 * document (Gemini Vision — backend-docs/invoices-api.md). Only meaningful
 * once `extractedAt` is set; any individual field can still be `null` — a
 * poor scan legitimately extracts nothing for a field, so `null` is rendered
 * as "—", never guessed at.
 *
 * `supplierNameRaw` / `poNumberRaw` are document claims, not verified facts —
 * three-way matching (not this screen) reconciles them against the PO. They
 * are visually labeled "From invoice" and must never read as confirmed.
 */
export function InvoiceExtractedFields({ invoice }: InvoiceExtractedFieldsProps) {
  const nonInrCurrency =
    invoice.currency != null && invoice.currency !== "INR" ? invoice.currency : null;

  const money = (paise: number | null) =>
    paise == null ? null : (
      <span className="inline-flex items-center gap-1">
        <Money paise={paise} />
        {nonInrCurrency && (
          <span className="text-xs font-normal text-muted-foreground">
            ({nonInrCurrency})
          </span>
        )}
      </span>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">Extracted fields</p>
        <FromInvoiceBadge />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <Field label="Invoice number" value={invoice.invoiceNumber} />
        <Field
          label="Invoice date"
          value={invoice.invoiceDate ? formatDate(invoice.invoiceDate) : null}
        />
        <Field label="Supplier (from invoice)" value={invoice.supplierNameRaw} raw />
        <Field label="PO number (from invoice)" value={invoice.poNumberRaw} raw />
        <Field label="Subtotal" value={money(invoice.subtotalPaise)} />
        <Field label="Tax" value={money(invoice.taxPaise)} />
        <Field label="Total" value={money(invoice.totalPaise)} />
        <Field label="Currency" value={invoice.currency} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Line items</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No readable line items on this document.
                </TableCell>
              </TableRow>
            ) : (
              invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {item.lineNumber}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Money paise={item.unitPricePaise} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    <Money paise={item.lineTotalPaise} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
