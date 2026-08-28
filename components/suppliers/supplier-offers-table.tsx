"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/common/money";
import { EmptyState } from "@/components/common/empty-state";
import { formatDate } from "@/lib/formatters";
import { PackageIcon } from "@/lib/icons";
import type { SupplierProductOffer } from "@/types/catalog";

interface SupplierOffersTableProps {
  offers: SupplierProductOffer[];
}

/**
 * One supplier's catalog offers. Prices are integer paise and rendered through
 * `Money`; the figures here are the same ones supplier discovery ranks on.
 */
export function SupplierOffersTable({ offers }: SupplierOffersTableProps) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={PackageIcon}
        title="No catalog offers"
        description="This supplier has no products in the catalog, so supplier discovery will never select it."
        className="py-10"
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Min order</TableHead>
            <TableHead className="text-right">Lead time</TableHead>
            <TableHead className="text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => (
            <TableRow key={offer.id}>
              <TableCell className="font-medium">
                <Link href={`/products/${offer.product.id}`} className="hover:underline">
                  {offer.product.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {offer.product.sku}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {offer.product.category ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <Money paise={offer.unitPricePaise} className="text-sm" />
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {offer.stockQuantity} {offer.product.unit}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {offer.minOrderQuantity}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {offer.deliveryDays} days
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                {formatDate(offer.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
