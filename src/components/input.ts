export function setupUserInput({ input }: { input: HTMLInputElement }) {
  // inputをlocalstorageから復元/保存
  restoreAndSaveInput(input, "userInput.setting");
}

function restoreAndSaveInput(input: HTMLInputElement, key: string) {
  const savedInput = localStorage.getItem(key);
  if (savedInput) {
    input.value = savedInput;
  }
  input.addEventListener("input", () => {
    localStorage.setItem(key, input.value);
  });
}
