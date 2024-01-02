import express from "express";

// Receber rotas internas
import index from "./routes/index.mjs";

const PORT = process.env.PORT || 3000;
const app = express();

app.use("/", index);

// start the Express server
app.listen(PORT, () => {
  console.log(`Servidor iniciado: http://localhost:${PORT}`);
});
