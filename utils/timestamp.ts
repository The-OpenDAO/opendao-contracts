function timestampInSecond() {
  return Math.floor(new Date().getTime() / 1000);
}

export { timestampInSecond };
