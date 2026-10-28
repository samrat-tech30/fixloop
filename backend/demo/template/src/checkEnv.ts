const key = process.env.API_KEY;

if (!key) {
  console.error("Error: API_KEY is not defined. Set it in your hosting provider's environment variables.");
  process.exit(1);
}

console.log("Environment OK");
