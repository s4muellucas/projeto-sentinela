
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: [],
      internacoes: [],
      tv_chamada: null,
      tv_historico: []
    };
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE));

  if (!db.tv_chamada) db.tv_chamada = null;
  if (!db.tv_historico) db.tv_historico = [];
  if (!db.internacoes) db.internacoes = [];
  if (!db.usuarios) db.usuarios = [];
  if (!db.pacientes) db.pacientes = [];
  if (!db.triagens) db.triagens = [];
  if (!db.consultas) db.consultas = [];

  return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// LOGIN
app.post("/login", (req, res) => {
  const db = readDB();

  const user = db.usuarios.find(u =>
    u.usuario === req.body.usuario &&
    u.senha === req.body.senha
  );

  if (!user) {
    return res.status(401).json({ erro: "Login inválido" });
  }

  res.json(user);
});

// ATENDIMENTO - cadastrar paciente
app.post("/atendimento", (req, res) => {
  const db = readDB();

  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo,
    status: "triagem",
    createdAt: new Date()
  };

  db.pacientes.push(paciente);
  writeDB(db);

  res.json(paciente);
});

// LISTAR PACIENTES
app.get("/pacientes", (req, res) => {
  const db = readDB();
  res.json(db.pacientes);
});

// CLASSIFICADOR AUTOMÁTICO DEMONSTRATIVO
function classificarRiscoDemo(sintoma, temperatura) {
  const sintomasDeAlerta = [
    "infarto",
    "avc",
    "convulsao",
    "hemorragia",
    "falta_ar_grave"
  ];

  const sintomasDeAtencao = [
    "febre",
    "vomito",
    "diarreia",
    "falta_ar_moderada"
  ];

  const tempInformada =
    temperatura !== undefined &&
    temperatura !== null &&
    String(temperatura).trim() !== "";

  const temp = Number(temperatura);

  if (
    !sintoma ||
    !tempInformada ||
    !Number.isFinite(temp) ||
    temp < 25 ||
    temp > 45
  ) {
    return {
      risco: "pendente",
      motivo: "Dados incompletos ou inválidos para a demonstração."
    };
  }

  if (sintomasDeAlerta.includes(sintoma)) {
    return {
      risco: "vermelho",
      motivo: "Regra demonstrativa de alerta acionada pelo sintoma."
    };
  }

  if (temp >= 39) {
    return {
      risco: "vermelho",
      motivo: "Regra demonstrativa de temperatura acionada."
    };
  }

  if (
    temp >= 38 ||
    sintomasDeAtencao.includes(sintoma)
  ) {
    return {
      risco: "amarelo",
      motivo: "Regra demonstrativa de atenção acionada."
    };
  }

  return {
    risco: "verde",
    motivo: "Nenhuma regra de alerta da demonstração foi acionada."
  };
}

// TRIAGEM
app.post("/triagem", (req, res) => {
  const db = readDB();

  const {
    nome,
    sintoma,
    temperatura,
    alergia,
    observacao
  } = req.body;

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({
      erro: "Informe o nome do paciente."
    });
  }

  // O servidor calcula a classificação.
  // Não confia no risco enviado pelo frontend.
  const classificacao = classificarRiscoDemo(
    sintoma,
    temperatura
  );

  const triagem = {
    id: Date.now(),
    nome: String(nome).trim(),
    sintoma,
    temperatura,
    alergia,
    observacao,
    risco: classificacao.risco,
    motivoClassificacao: classificacao.motivo,
    metodoClassificacao: "regras_demo",
    status: "aguardando_medico",
    createdAt: new Date()
  };

  db.triagens.push(triagem);
  writeDB(db);

  res.json(triagem);
});

// LISTAR TRIAGENS
app.get("/triagens", (req, res) => {
  const db = readDB();
  res.json(db.triagens);
});

// MÍDIA INDOOR - TV
app.post("/tv/chamar", (req, res) => {
  const db = readDB();

  const chamada = {
    id: Date.now().toString(),
    localTipo: req.body.localTipo,
    localNumero: req.body.localNumero,
    paciente: req.body.paciente,
    hora: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    })
  };

  db.tv_chamada = chamada;
  db.tv_historico.unshift(chamada);

  if (db.tv_historico.length > 5) {
    db.tv_historico.pop();
  }

  writeDB(db);

  res.json(chamada);
});

app.get("/tv/chamada", (req, res) => {
  const db = readDB();

  res.json({
    chamada: db.tv_chamada,
    historico: db.tv_historico
  });
});

// LISTA DE MEDICAÇÕES
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});

// CONSULTA
app.post("/consulta", (req, res) => {
  const db = readDB();

  const consulta = {
    id: Date.now(),
    paciente: req.body.paciente,
    diagnostico: req.body.diagnostico,
    medicacao: req.body.medicacao,
    obs: req.body.obs,
    createdAt: new Date()
  };

  db.consultas.push(consulta);
  writeDB(db);

  res.json(consulta);
});

// MEDICAÇÕES
app.get("/medicacoes", (req, res) => {
  const db = readDB();
  res.json(db.consultas);
});

// INTERNAÇÃO
app.post("/internacao", (req, res) => {
  const db = readDB();

  const internacao = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    nascimento: req.body.nascimento,
    motivo: req.body.motivo,
    setor: req.body.setor,
    data: req.body.data,
    leito: req.body.leito,
    status: "internado",
    createdAt: new Date()
  };

  db.internacoes.push(internacao);
  writeDB(db);

  res.json(internacao);
});

// LISTAR INTERNAÇÕES
app.get("/internacoes", (req, res) => {
  const db = readDB();
  res.json(db.internacoes);
});

// START
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
