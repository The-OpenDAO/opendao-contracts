export function timestampInSecond() {
  return Math.floor(new Date().getTime() / 1000);
}

export function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
