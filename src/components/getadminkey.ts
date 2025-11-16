let adminKey: string | null = null;

export function getadminkey() {
  adminKey ??= prompt("管理者キーを入力してください");
  if (!adminKey) {
    throw new Error("管理者キーが入力されていません");
  }
    return adminKey;
}