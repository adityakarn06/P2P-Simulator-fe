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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { formatRate, getCheapestOffer, getOnTimeRate } from "@/lib/state/catalog-state";
import { PackageIcon } from "@/lib/icons";
import type { ProductSupplierOffer } from "@/types/catalog";

interface ProductOffersTableProps {
  offers: ProductSupplierOffer[];
}

/**
 * Every supplier offering one product, price against reliability side by side.
 *
 * The API already returns these cheapest first, then fastest — the ordering
 * supplier discovery starts from — so the rows are rendered in the order given
 * rather than re-sorted, and the cheapest row is marked so the screen and the
 * sourcing engine visibly agree on "best price". Cheapest is not the same as
 * *selected*: discovery also weighs reliability and lead time.
 */
export function ProductOffersTable({ offers }: ProductOffersTableProps) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={PackageIcon}
        title="No supplier offers"
        description="No supplier in the catalog stocks this product, so a requisition for it cannot be sourced."
        className="py-10"
      />
    );
  }

  const cheapest = getCheapestOffer(offers);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Unit price</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Min order</TableHead>
            <TableHead className="text-right">Lead time</TableHead>
            <TableHead className="text-right">Reliability</TableHead>
            <TableHead className="text-right">On time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => (
            <TableRow key={offer.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/suppliers/${offer.supplier.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {offer.supplier.name}
                  </Link>
                  {cheapest?.id === offer.id && (
                    <Badge variant="outline" className="text-[10px]">
                      Lowest price
                    </Badge>
                  )}
                  {!offer.supplier.isActive && (
                    <Badge variant="outline" className="text-[10px]">
                      Inactive
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Money paise={offer.unitPricePaise} className="text-sm" />
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {offer.stockQuantity}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {offer.minOrderQuantity}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {offer.deliveryDays} days
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {formatRate(offer.supplier.reliabilityScore)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                {formatRate(getOnTimeRate(offer.supplier))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
