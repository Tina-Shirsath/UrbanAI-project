const { hashAdminPassword } = require("../middleware/adminAuth");

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== "function") {
      reject(new Error("Run this command in an interactive terminal."));
      return;
    }

    const output = process.stdout;
    let value = "";
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");

    const finish = (error) => {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") return finish(new Error("Cancelled."));
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else if (char >= " ") {
          value += char;
        }
      }
    };

    input.on("data", onData);
  });
}

async function main() {
  const username = process.argv[2] || "";
  if (!username || /[\r\n=]/.test(username)) {
    throw new Error("Usage: npm run provision-admin -- <admin-username>");
  }

  const password = await readHidden("New admin password (input hidden): ");
  if (password.length < 12) {
    throw new Error("Use an administrator password of at least 12 characters.");
  }

  const passwordHash = await hashAdminPassword(password);

  process.stdout.write("Add these values to the backend environment (not source control):\n");
  process.stdout.write(`ADMIN_USERNAME=${username}\n`);
  process.stdout.write(`ADMIN_PASSWORD_HASH=${passwordHash}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
