/**
 * 電話番号から数字以外を除去します。
 * @param phone 電話番号文字列
 * @returns 数字のみの文字列
 */
export const normalizePhoneNumber = (phone: string): string => {
    return phone.replace(/[^0-9]/g, '');
};

/**
 * 電話番号を「XXX-XXXX-XXXX」形式にフォーマットします。
 * Excelインポート時の先頭0欠落にも対応します。
 * @param phone 電話番号文字列
 * @returns フォーマットされた電話番号
 */
export const formatPhoneNumber = (phone: string): string => {
    let normalized = normalizePhoneNumber(phone);

    // 先頭が0でなく、かつ9桁または10桁の場合は先頭に0を補完（Excelインポート対策）
    if (normalized.length > 0 && normalized[0] !== '0') {
        if (normalized.length === 10 || normalized.length === 9) {
            normalized = '0' + normalized;
        }
    }

    // 14桁 (例外ルール: ハイフンなし)
    if (normalized.length === 14) {
        return normalized;
    }

    // 11桁 (携帯電話など) -> 3-4-4
    if (normalized.length === 11) {
        return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7, 11)}`;
    }

    // 10桁 (固定電話など)
    if (normalized.length === 10) {
        // 東京(03), 大阪(06)などは 2-4-4
        if (normalized.startsWith('03') || normalized.startsWith('06')) {
            return `${normalized.slice(0, 2)}-${normalized.slice(2, 6)}-${normalized.slice(6, 10)}`;
        }
        // その他は一般的に 3-3-4
        return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6, 10)}`;
    }

    // それ以外は正規化されたものを返す（ハイフン除去などの最低限の整形）
    return normalized || phone;
};
