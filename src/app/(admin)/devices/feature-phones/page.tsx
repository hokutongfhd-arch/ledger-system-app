"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useData } from "../../../../features/context/DataContext";
import { useAuth } from "../../../../features/context/AuthContext";
import { Pagination } from "../../../../components/ui/Pagination";
import { Table } from "../../../../components/ui/Table";
import type { FeaturePhone } from "../../../../lib/types";
import {
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "../../../../components/ui/Modal";
import { FeaturePhoneForm } from "../../../../features/devices/components/FeaturePhoneForm";
import * as XLSX from "xlsx";
import { normalizeContractYear } from "../../../../lib/utils/stringUtils";
import ExcelJS from "exceljs";
import { FeaturePhoneDetailModal } from "../../../../features/devices/components/FeaturePhoneDetailModal";
import { useConfirm } from "../../../../hooks/useConfirm";
import { formatPhoneNumber } from "../../../../lib/utils/phoneUtils";
import { useToast } from "../../../../features/context/ToastContext";
import { useServerDataTable } from "../../../../hooks/useServerDataTable";
import { useCSVExport } from "../../../../hooks/useCSVExport";
import { useFileImport } from "../../../../hooks/useFileImport";
import { logger } from "../../../../lib/logger";
import {
  fetchFeaturePhonesPaginatedAction,
  fetchFeaturePhonesAllAction,
} from "../../../../app/actions/device_fetch";
import { mapFeaturePhoneFromDb } from "../../../../features/context/DataContext";

export default function FeaturePhoneListPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  if (!user) return null;

  return <FeaturePhoneListContent />;
}

function FeaturePhoneListContent() {
  const {
    featurePhones,
    addFeaturePhone,
    updateFeaturePhone,
    deleteFeaturePhone,
    deleteManyFeaturePhones,
    employees,
    addresses,
    employeeMap,
    addressMap,
    fetchFeaturePhones,
    handleCRUDError,
    setIsSyncing,
  } = useData();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const highlightId = searchParams.get("highlight");
  const { confirm, ConfirmDialog } = useConfirm();
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FeaturePhone | undefined>(
    undefined,
  );
  const [detailItem, setDetailItem] = useState<FeaturePhone | undefined>(
    undefined,
  );

  const {
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    sortCriteria,
    toggleSort,
    selectedIds,
    setSelectedIds,
    handleSelectAll,
    handleCheckboxChange,
    paginatedData,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    isAllSelected,
    refetch,
    isLoading,
  } = useServerDataTable<FeaturePhone>({
    fetchData: fetchFeaturePhonesPaginatedAction as any,
    mapData: mapFeaturePhoneFromDb,
    initialPageSize: 15,
  });

  const { handleExport } = useCSVExport<FeaturePhone>();
  // Updated headers order
  const headers = [
    "管理番号(必須)",
    "電話番号(必須)",
    "機種名",
    "契約年数",
    "キャリア",
    "状況",
    "社員コード",
    "事業所コード",
    "負担先",
    "受領書提出日",
    "貸与日",
    "返却日",
    "備考",
  ];

  const { handleImportClick, fileInputRef, handleFileChange } = useFileImport({
    headerRowIndex: 1, // New format has headers in the 2nd row (index 1)
    onValidate: async (rows, fileHeaders) => {
      const requiredHeaders = headers;
      const missingHeaders = requiredHeaders.filter(
        (h) => !fileHeaders.includes(h),
      );
      if (missingHeaders.length > 0) {
        await confirm({
          title: "インポートエラー",
          description: `不足している項目があります: ${missingHeaders.join(", ")}`,
          confirmText: "OK",
          cancelText: "",
        });
        return false;
      }

      const validColumnCount = requiredHeaders.length;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        if (row.length > validColumnCount) {
          const extraData = row.slice(validColumnCount);
          const hasExtraData = extraData.some(
            (cell: any) =>
              cell !== undefined && cell !== null && String(cell).trim() !== "",
          );
          if (hasExtraData) {
            await confirm({
              title: "インポートエラー",
              description:
                "定義された列の外側にデータが存在します。ファイルを確認してください。",
              confirmText: "OK",
              cancelText: "",
            });
            return false;
          }
        }
      }
      return true;
    },
    onImport: async (rows, fileHeaders) => {
      setIsSyncing(true);
      const allFeaturePhonesRaw = await fetchFeaturePhonesAllAction();
      const allFeaturePhones = allFeaturePhonesRaw.map(mapFeaturePhoneFromDb);
      const { validateDeviceImportRow } =
        await import("../../../../features/devices/device-import-validator");

      let successCount = 0;
      let errorCount = 0;
      const existingManagementNumbers = new Set(
        allFeaturePhones.map((d) => d.managementNumber),
      );
      const existingPhoneNumbers = new Set(
        allFeaturePhones.map((d) => d.phoneNumber.replace(/-/g, "")),
      );
      const processedManagementNumbers = new Set<string>();
      const processedPhoneNumbers = new Set<string>();
      const errors: string[] = [];

      const importData: any[] = [];

      const validCarriers = ["KDDI", "SoftBank", "Docomo", "Rakuten", "その他"];
      const validStatuses = [
        "使用中",
        "予備機",
        "在庫",
        "故障",
        "修理中",
        "廃棄",
      ];
      const statusMap: Record<string, string> = {
        使用中: "in-use",
        予備機: "backup",
        在庫: "available",
        故障: "broken",
        修理中: "repairing",
        廃棄: "discarded",
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const isRowEmpty = row.every(
          (cell: any) =>
            cell === undefined || cell === null || String(cell).trim() === "",
        );
        if (isRowEmpty) continue;

        const rowData: any = {};
        fileHeaders.forEach((header, index) => {
          rowData[header] = row[index];
        });

        const validEmployeeCodes = new Set(employees.map((e) => e.code));
        const validOfficeCodes = new Set(addresses.map((a) => a.addressCode));

        const validation = validateDeviceImportRow(
          rowData,
          i,
          existingPhoneNumbers,
          processedPhoneNumbers,
          existingManagementNumbers,
          processedManagementNumbers,
          validEmployeeCodes,
          validOfficeCodes,
        );

        if (!validation.isValid) {
          errors.push(...validation.errors);
          continue;
        }

        const toHalfWidth = (str: string) =>
          str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
            String.fromCharCode(s.charCodeAt(0) - 0xfee0),
          );

        const rawPhoneNumber = String(rowData["電話番号(必須)"] || "");
        const phoneNumber = formatPhoneNumber(
          toHalfWidth(rawPhoneNumber).trim(),
        );

        const rawManagementNumber = String(rowData["管理番号(必須)"] || "");
        const managementNumber = toHalfWidth(rawManagementNumber).trim();

        const formatDate = (val: any) => {
          if (!val) return "";
          if (typeof val === "number") {
            const date = new Date((val - 25569) * 86400 * 1000);
            return date.toISOString().split("T")[0];
          }
          return String(val).trim().replace(/\//g, "-");
        };

        const formatAddressCode = (code: string) => {
          const cleanCode = String(code || "").trim();
          if (cleanCode.length === 6 && /^\d+$/.test(cleanCode)) {
            return `${cleanCode.slice(0, 4)}-${cleanCode.slice(4)}`;
          }
          return cleanCode;
        };

        const rawStatus = String(rowData["状況"] || "").trim();
        const employeeId = String(rowData["社員コード"] || "").trim();
        const addressCode = formatAddressCode(rowData["事業所コード"]);

        let finalStatus: any;
        if (employeeId || addressCode) {
          finalStatus = "in-use";
        } else if (rawStatus === "") {
          finalStatus = "available";
        } else {
          finalStatus = statusMap[rawStatus] || "available";
        }

        const newFeaturePhone: Omit<FeaturePhone, "id"> = {
          carrier: String(rowData["キャリア"] || ""),
          phoneNumber: phoneNumber,
          managementNumber: managementNumber,
          employeeCode: employeeId,
          addressCode: addressCode,
          lendDate: formatDate(rowData["貸与日"]),
          receiptDate: formatDate(rowData["受領書提出日"]),
          notes: String(rowData["備考"] || ""),
          returnDate: formatDate(rowData["返却日"]),
          modelName: String(rowData["機種名"] || ""),
          contractYears: normalizeContractYear(
            String(rowData["契約年数"] || ""),
          ),
          costCompany: String(rowData["負担先"] || ""),
          status: finalStatus,
          version: 1,
          updatedAt: "",
        };

        importData.push(newFeaturePhone);
        if (validation.managementNumber)
          processedManagementNumbers.add(validation.managementNumber);
        if (validation.normalizedPhone)
          processedPhoneNumbers.add(validation.normalizedPhone);
      }

      // All-or-Nothing check
      if (errors.length > 0) {
        await confirm({
          title: "インポートエラー",
          description: (
            <div className="max-h-60 overflow-y-auto">
              <p className="font-bold text-red-600 mb-2">
                エラーが存在するため、インポートを中止しました。
              </p>
              <ul className="list-disc pl-5 text-sm text-red-600">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          ),
          confirmText: "閉じる",
          cancelText: "",
        });
        return;
      }

      // Execution Phase
      for (const data of importData) {
        try {
          await addFeaturePhone(
            data as Omit<FeaturePhone, "id">,
            true,
            true,
            true,
          );
          successCount++;
        } catch (error: any) {
          const errorMsg =
            error.message === "DuplicateError"
              ? "競合エラー"
              : error.message || "不明なエラー";
          errors.push(`登録エラー: ${data.managementNumber} - ${errorMsg}`);
          errorCount++;
        }
      }

      if (errors.length > 0) {
        await confirm({
          title: "インポートエラー",
          description: (
            <div className="max-h-60 overflow-y-auto">
              <p className="mb-2 font-bold text-red-600">
                エラーが存在するため、インポートを中止しました。
              </p>
              <ul className="list-disc pl-5 text-sm text-red-600">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          ),
          confirmText: "OK",
          cancelText: "",
        });
      }

      if (successCount > 0 && errorCount === 0) {
        showToast(
          `インポート完了 - 成功: ${successCount}件 / 失敗: ${errorCount}件`,
          "success",
        );
      }
      refetch();
      setIsSyncing(false);
    },
  });

  const handleAdd = () => {
    setEditingItem(undefined);
    setIsModalOpen(true);
  };
  const handleEdit = (item: FeaturePhone) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: FeaturePhone) => {
    const confirmed = await confirm({
      title: "確認",
      description: "本当にこのガラホを削除しますか？",
      confirmText: "Delete",
      variant: "destructive",
    });

    if (confirmed) {
      try {
        await deleteFeaturePhone(item.id, item.version, false, true);
        refetch();
      } catch (error: any) {
        // console.error(error);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await confirm({
      title: "確認",
      description: `選択した ${selectedIds.size} 件のガラホを削除しますか？`,
      confirmText: "Delete",
      variant: "destructive",
    });
    if (confirmed) {
      try {
        await deleteManyFeaturePhones(Array.from(selectedIds));
        setSelectedIds(new Set());
        refetch();
      } catch (error) {
        // console.error(error);
      }
    }
  };

  const handleExportCSVClick = async () => {
    // Log the export action
    await logger.log({
      action: "EXPORT",
      targetType: "feature_phone",
      targetId: "feature_phone_list",
      result: "success",
      message: `ガラホ一覧のエクスポート開始`,
    });

    const statusLabelMap: Record<string, string> = {
      "in-use": "使用中",
      backup: "予備機",
      available: "在庫",
      broken: "故障",
      repairing: "修理中",
      discarded: "廃棄",
    };

    try {
      const allMatchingRaw = await fetchFeaturePhonesAllAction(searchTerm);
      const allMatching = allMatchingRaw.map(mapFeaturePhoneFromDb);

      handleExport(
        allMatching,
        headers,
        `feature_phone_list_${new Date().toISOString().split("T")[0]}.csv`,
        (item) => [
          item.managementNumber,
          formatPhoneNumber(item.phoneNumber),
          item.modelName,
          normalizeContractYear(item.contractYears || ""),
          item.carrier,
          statusLabelMap[item.status] || item.status,
          item.employeeCode,
          item.addressCode,
          item.costCompany || "",
          item.receiptDate,
          item.lendDate,
          item.returnDate,
          `"${item.notes}"`,
        ],
      );
    } catch (error) {
      console.error("Export failed:", error);
      showToast("エクスポートに失敗しました", "error");
    }
  };

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Template");

    // Styles
    const fontStyle = { name: "Yu Gothic" };
    const headerFont1 = { name: "Yu Gothic", bold: true, size: 16 };
    const headerFont2 = { name: "Yu Gothic", bold: true, size: 11 };

    // Set column widths and default font FIRST
    worksheet.columns = headers.map(() => ({
      width: 20,
      style: { font: fontStyle },
    }));

    // --- Row 1: Merged Headers ---
    // Basic Info: A-F
    worksheet.mergeCells("A1:F1");
    const cellA1 = worksheet.getCell("A1");
    cellA1.value = "基本情報";
    cellA1.alignment = { vertical: "middle", horizontal: "center" };
    cellA1.font = headerFont1;
    cellA1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFBE5D6" }, // Light Orange
    };

    // User Info: G-L
    worksheet.mergeCells("G1:L1");
    const cellG1 = worksheet.getCell("G1");
    cellG1.value = "使用者情報";
    cellG1.alignment = { vertical: "middle", horizontal: "center" };
    cellG1.font = headerFont1;
    cellG1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2EFDA" }, // Light Olive
    };

    // Others: M only (Previously M-O)
    const cellM1 = worksheet.getCell("M1");
    cellM1.value = "その他";
    cellM1.alignment = { vertical: "middle", horizontal: "center" };
    cellM1.font = headerFont1;
    cellM1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDDEBF7" }, // Light Aqua
    };

    // --- Row 2: Column Headers ---
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);

    // Style Row 2
    for (let i = 1; i <= headers.length; i++) {
      const cell = headerRow.getCell(i);
      cell.font = headerFont2;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" }, // Grey 15%
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    // Removed validation/styling for N, O columns as requested.
    // N column onwards should be default style, and input will catch error in import.

    // Adjust Row Heights
    worksheet.getRow(1).height = 30;
    worksheet.getRow(2).height = 25;

    const totalRows = 1000;

    // Apply Data Validation and Formats
    // Columns Indices:
    // 1: Management No (Text)
    // 2: Phone No (Text)
    // 3: Model
    // 4: Contract Years
    // 5: Carrier (Dropdown)
    // 6: Status (Dropdown)
    // 7: Emp Code (Text)
    // 8: Office Code (Text)
    // 9: Cost Bearer
    // 10: Receipt Date (Date)
    // 11: Lend Date (Date)
    // 12: Return Date (Date)
    // 13: Notes

    // Text Formats: A(1), B(2), G(7), H(8)
    worksheet.getColumn(1).numFmt = "@";
    worksheet.getColumn(2).numFmt = "@";
    worksheet.getColumn(7).numFmt = "@";
    worksheet.getColumn(8).numFmt = "@";

    // Date Formats: J(10), K(11), L(12)
    worksheet.getColumn(10).numFmt = "yyyy/mm/dd";
    worksheet.getColumn(11).numFmt = "yyyy/mm/dd";
    worksheet.getColumn(12).numFmt = "yyyy/mm/dd";

    // Data Validation Loop
    for (let i = 3; i <= totalRows + 2; i++) {
      // Carrier (Column 5)
      worksheet.getCell(i, 5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"KDDI,SoftBank,Docomo,Rakuten,その他"'],
      };

      // Status (Column 6)
      worksheet.getCell(i, 6).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"使用中,予備機,在庫,故障,修理中,廃棄"'],
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ガラホエクセルフォーマット.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const isAdmin = user?.role === "admin";
  const hasPermission = (item: FeaturePhone) =>
    isAdmin || user?.code === item.employeeCode;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in-use":
        return "bg-green-100 text-green-700 border-green-200";
      case "backup":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "available":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "broken":
        return "bg-red-100 text-red-700 border-red-200";
      case "repairing":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "discarded":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-50 text-gray-500 border-gray-100";
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      "in-use": "使用中",
      backup: "予備機",
      available: "在庫",
      broken: "故障",
      repairing: "修理中",
      discarded: "廃棄",
    };
    return map[status] || status;
  };

  const getSortIcon = (key: keyof FeaturePhone | "userName") => {
    // Cast for safety
    const idx = sortCriteria.findIndex(
      (c) => c.key === (key === "userName" ? "employeeCode" : key),
    );
    if (idx === -1)
      return <ArrowUpDown size={14} className="ml-1 text-gray-400" />;
    const c = sortCriteria[idx];
    return (
      <div className="flex items-center gap-0.5 ml-1">
        {c.order === "asc" ? (
          <ArrowUp size={14} className="text-blue-600" />
        ) : (
          <ArrowDown size={14} className="text-blue-600" />
        )}
        {sortCriteria.length > 1 && (
          <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {idx + 1}
          </span>
        )}
      </div>
    );
  };

  const getRowClassName = (item: FeaturePhone) =>
    item.id === highlightId ? "bg-red-100 hover:bg-red-200" : "";

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-text-main">ガラホ管理台帳</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSVClick}
            className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"
          >
            <Download size={18} />
            CSV出力
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"
          >
            <FileSpreadsheet size={18} />
            フォーマットDL
          </button>
          <button
            onClick={handleImportClick}
            className="bg-background-paper text-text-secondary border border-border px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-background-subtle shadow-sm"
          >
            <Upload size={18} />
            インポート
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleAdd}
            className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover shadow-sm"
          >
            <Plus size={18} />
            新規登録
          </button>
        </div>
      </div>

      <div className="bg-background-paper p-4 rounded-xl shadow-card border border-border flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted z-10"
            size={18}
          />
          <input
            type="text"
            placeholder="検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-border rounded-lg outline-none bg-background-subtle text-text-main"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <Table<FeaturePhone>
        containerClassName="max-h-[600px] overflow-auto border-b border-border"
        data={paginatedData}
        rowClassName={getRowClassName}
        columns={[
          {
            header: (
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4"
              />
            ),
            accessor: (item) => (
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => handleCheckboxChange(item.id)}
                className="w-4 h-4"
              />
            ),
            className: "w-10 px-4",
          },
          {
            header: (
              <div
                className="flex items-center cursor-pointer"
                onClick={() => toggleSort("managementNumber")}
              >
                管理番号{getSortIcon("managementNumber")}
              </div>
            ),
            accessor: (item) => (
              <button
                onClick={() => setDetailItem(item)}
                className="text-blue-600 hover:underline"
              >
                {item.managementNumber}
              </button>
            ),
          },
          {
            header: (
              <div
                className="flex items-center cursor-pointer"
                onClick={() => toggleSort("modelName")}
              >
                機種名{getSortIcon("modelName")}
              </div>
            ),
            accessor: "modelName",
          },
          {
            header: (
              <div
                className="flex items-center cursor-pointer"
                onClick={() => toggleSort("phoneNumber")}
              >
                電話番号{getSortIcon("phoneNumber")}
              </div>
            ),
            accessor: (item) => formatPhoneNumber(item.phoneNumber),
          },
          {
            header: (
              <div
                className="flex items-center cursor-pointer"
                onClick={() => toggleSort("employeeCode")}
              >
                使用者{getSortIcon("userName")}
              </div>
            ),
            accessor: (item) => employeeMap.get(item.employeeCode)?.name || "",
          },
          {
            header: (
              <div
                className="flex items-center cursor-pointer"
                onClick={() => toggleSort("addressCode")}
              >
                使用事業所{getSortIcon("addressCode")}
              </div>
            ),
            accessor: (item) => {
              const addr = addressMap.get(item.addressCode);
              return addr ? addr.officeName : item.addressCode || "";
            },
          },
          {
            header: (
              <div
                className="flex items-center cursor-pointer"
                onClick={() => toggleSort("status")}
              >
                状況{getSortIcon("status")}
              </div>
            ),
            accessor: (item) => (
              <span
                className={`px-2 py-1 text-xs font-bold rounded-full border ${getStatusColor(item.status)}`}
              >
                {getStatusLabel(item.status)}
              </span>
            ),
          },
        ]}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={hasPermission}
        canDelete={hasPermission}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        startIndex={startIndex}
        endIndex={endIndex}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        selectedCount={selectedIds.size}
        onBulkDelete={handleBulkDelete}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "ガラホ 編集" : "ガラホ 新規登録"}
      >
        <FeaturePhoneForm
          initialData={editingItem}
          onSubmit={async (data) => {
            try {
              if (editingItem) {
                await updateFeaturePhone({
                  ...data,
                  id: editingItem.id,
                  version: editingItem.version,
                } as FeaturePhone);
              } else {
                await addFeaturePhone({
                  ...data,
                  id: undefined,
                  version: 1,
                  updatedAt: "",
                } as any);
              }
              setIsModalOpen(false);
              setEditingItem(undefined);
              refetch();
            } catch (error: any) {
              const isDuplicate = error?.message?.includes("DuplicateError");
              const isConflict = error?.message?.includes("ConcurrencyError");
              const isNotFound = error?.message?.includes("NotFoundError");

              if (isDuplicate || isConflict || isNotFound) {
                setIsModalOpen(false);
                setEditingItem(undefined);
              }
            }
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <FeaturePhoneDetailModal
        isOpen={!!detailItem}
        onClose={() => setDetailItem(undefined)}
        item={detailItem}
        employees={employees}
        addresses={addresses}
      />

      <ConfirmDialog />
    </div>
  );
}
