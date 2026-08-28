"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  generateInvoice,
  type GenerateInvoiceItemOverride,
} from "@/lib/api/documents";
import { triggerBrowserDownload } from "@/lib/documents";
import type { BinaryResponse } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";
import { ApiError } from "@/types/api";
import type { Invoice } from "@/types/models";
import { invoiceKeys } from "@/hooks/use-invoices";
import { purchaseOrderKeys } from "@/hooks/use-purchase-orders";
import { requisitionKeys } from "@/hooks/use-requisitions";

/**
 * Downloads one of the three /pdf documents (backend-docs/documents-api.md).
 * `fetcher` is passed in per call site (getPurchaseOrderPdf/getReceiptPdf/
 * getInvoicePdf bound to an id) rather than baked in here, since all three
 * share the same success/error handling.
 */
export function useDownloadDocument() {
  return useMutation<
    BinaryResponse,
    Error,
    { fetcher: () => Promise<BinaryResponse>; fallbackFilename: string }
  >({
    mutationFn: ({ fetcher }) => fetcher(),
    onSuccess: (response, variables) => {
      triggerBrowserDownload(response.blob, response.filename ?? variables.fallbackFilename);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}

export interface DocumentPreviewState {
  isOpen: boolean;
  isLoading: boolean;
  error: unknown;
  objectUrl: string | null;
  mimeType: string | null;
  filename: string | null;
  open: () => void;
  close: () => void;
}

/**
 * Owns a single document preview's lifecycle: fetches the blob when opened,
 * holds an object URL only as long as the dialog is open, and revokes it on
 * close and on unmount. Never persists the URL anywhere — CLAUDE.md: never
 * persist signed/temporary file URLs — which is also why this reads through
 * the document endpoints rather than Invoice.fileUrl (a signed, expiring
 * Cloudinary URL).
 */
export function useDocumentPreview(fetcher: () => Promise<BinaryResponse>): DocumentPreviewState {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const revoke = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revoke(), [revoke]);

  const open = useCallback(() => {
    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((response) => {
        revoke();
        const url = URL.createObjectURL(response.blob);
        objectUrlRef.current = url;
        setObjectUrl(url);
        setMimeType(response.mimeType);
        setFilename(response.filename);
      })
      .catch((err) => setError(err))
      .finally(() => setIsLoading(false));
  }, [revoke]);

  const close = useCallback(() => {
    setIsOpen(false);
    revoke();
    setObjectUrl(null);
    setMimeType(null);
    setFilename(null);
    setError(null);
  }, [revoke]);

  return { isOpen, isLoading, error, objectUrl, mimeType, filename, open, close };
}

export interface GenerateInvoiceVariables {
  purchaseOrderId: string;
  requisitionId?: string;
  items?: GenerateInvoiceItemOverride[];
}

/**
 * Invalidates everything a new (or idempotently-repeated) GENERATED invoice
 * can change: the invoice lists — both the plain purchaseOrderId filter and
 * any source-scoped ones share the "invoices","list" prefix — the owning
 * PO's detail/list, and the requisition's detail/list. Same shape as
 * invalidateAfterUpload in use-invoices.ts.
 */
function invalidateAfterGenerate(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: GenerateInvoiceVariables
) {
  queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
  queryClient.invalidateQueries({
    queryKey: purchaseOrderKeys.detail(variables.purchaseOrderId),
  });
  queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
  if (variables.requisitionId) {
    queryClient.invalidateQueries({
      queryKey: requisitionKeys.detail(variables.requisitionId),
    });
    queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() });
  }
}

/**
 * POST /purchase-orders/:id/generate-invoice. Idempotent — a repeat call
 * returns 200 with the invoice already on file, which flows through
 * onSuccess exactly like the first, 201 call.
 */
export function useGenerateInvoice() {
  const queryClient = useQueryClient();

  return useMutation<Invoice, Error, GenerateInvoiceVariables>({
    mutationFn: ({ purchaseOrderId, items }) => generateInvoice(purchaseOrderId, items),
    onSuccess: (_data, variables) => invalidateAfterGenerate(queryClient, variables),
    onError: (error, variables) => {
      if (error instanceof ApiError && (error.isConflict || error.isNotFound)) {
        invalidateAfterGenerate(queryClient, variables);
      }
    },
  });
}
