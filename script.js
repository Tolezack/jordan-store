// Troque pela URL do seu backend no Render depois do deploy.
const API_URL = "http://localhost:3000";

let produtos = [];
let carrinho = JSON.parse(localStorage.getItem("jws_carrinho") || "[]");
let pagamentoTimer = null;

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function carregarProdutos() {
  const grid = document.getElementById("produtosGrid");
  grid.innerHTML = "<p>Carregando produtos...</p>";

  try {
    const res = await fetch(`${API_URL}/api/produtos`);
    const data = await res.json();
    produtos = data.produtos || [];
    renderProdutos();
    atualizarCarrinho();
  } catch (err) {
    console.error(err);
    grid.innerHTML = "<p>Erro ao carregar produtos. Veja se o backend está online.</p>";
  }
}

function renderProdutos() {
  const grid = document.getElementById("produtosGrid");
  const busca = document.getElementById("busca").value.toLowerCase().trim();
  const categoria = document.getElementById("categoria").value;

  const filtrados = produtos.filter(p => {
    const okBusca = !busca || String(p.nome || "").toLowerCase().includes(busca);
    const okCategoria = categoria === "all" || p.categoria === categoria;
    return okBusca && okCategoria;
  });

  if (filtrados.length === 0) {
    grid.innerHTML = "<p>Nenhum produto encontrado.</p>";
    return;
  }

  grid.innerHTML = filtrados.map(p => {
    const estoque = Number(p.estoque || 0);
    const disabled = estoque <= 0 ? "disabled" : "";
    return `
      <article class="product">
        <img src="${p.imagem || ""}" alt="${p.nome || "Produto"}" onerror="this.src='https://via.placeholder.com/300x300?text=Produto'" />
        <div class="info">
          <h3>${p.nome}</h3>
          <div class="price">${moeda(p.preco)}</div>
          <div class="stock">${estoque > 0 ? `Estoque: ${estoque}` : "Esgotado"}</div>
          <button class="primary" ${disabled} onclick="adicionarCarrinho('${p.id}')">
            ${estoque > 0 ? "Adicionar" : "Esgotado"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function salvarCarrinho() {
  localStorage.setItem("jws_carrinho", JSON.stringify(carrinho));
}

function adicionarCarrinho(id) {
  const produto = produtos.find(p => p.id === id);
  if (!produto) return;

  const item = carrinho.find(i => i.id === id);
  if (item) {
    if (item.quantidade + 1 > Number(produto.estoque || 0)) {
      alert("Sem estoque suficiente.");
      return;
    }
    item.quantidade += 1;
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: Number(produto.preco || 0),
      imagem: produto.imagem || "",
      quantidade: 1
    });
  }

  salvarCarrinho();
  atualizarCarrinho();
}

function alterarQtd(id, delta) {
  const item = carrinho.find(i => i.id === id);
  if (!item) return;

  const produto = produtos.find(p => p.id === id);
  const max = Number(produto?.estoque || 999);

  item.quantidade += delta;
  if (item.quantidade <= 0) {
    carrinho = carrinho.filter(i => i.id !== id);
  } else if (item.quantidade > max) {
    item.quantidade = max;
    alert("Sem estoque suficiente.");
  }

  salvarCarrinho();
  atualizarCarrinho();
}

function atualizarCarrinho() {
  document.getElementById("cartCount").textContent = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  document.getElementById("cartTotal").textContent = moeda(total);

  const box = document.getElementById("cartItems");
  if (carrinho.length === 0) {
    box.innerHTML = "<p>Carrinho vazio.</p>";
    return;
  }

  box.innerHTML = carrinho.map(item => `
    <div class="cart-item">
      <img src="${item.imagem}" alt="${item.nome}" />
      <div>
        <strong>${item.nome}</strong>
        <span>${moeda(item.preco)} cada</span>
        <div class="cart-item-controls">
          <button onclick="alterarQtd('${item.id}', -1)">-</button>
          <span>${item.quantidade}</span>
          <button onclick="alterarQtd('${item.id}', 1)">+</button>
        </div>
      </div>
    </div>
  `).join("");
}

function abrirCarrinho() {
  document.getElementById("overlay").classList.remove("hidden");
  document.getElementById("cartPanel").classList.remove("hidden");
}

function abrirCheckout() {
  if (carrinho.length === 0) {
    alert("Carrinho vazio.");
    return;
  }
  document.getElementById("cartPanel").classList.add("hidden");
  document.getElementById("overlay").classList.remove("hidden");
  document.getElementById("checkoutModal").classList.remove("hidden");
}

function fecharModais() {
  document.getElementById("overlay").classList.add("hidden");
  document.getElementById("cartPanel").classList.add("hidden");
  document.getElementById("checkoutModal").classList.add("hidden");
  document.getElementById("pixModal").classList.add("hidden");
  if (pagamentoTimer) clearInterval(pagamentoTimer);
}

function limparCarrinho() {
  if (!confirm("Limpar carrinho?")) return;
  carrinho = [];
  salvarCarrinho();
  atualizarCarrinho();
}

async function criarPix() {
  const cliente = {
    nome: document.getElementById("clienteNome").value.trim(),
    email: document.getElementById("clienteEmail").value.trim(),
    telefone: document.getElementById("clienteTelefone").value.trim(),
    endereco: document.getElementById("clienteEndereco").value.trim()
  };

  if (!cliente.nome || !cliente.email || !cliente.telefone) {
    alert("Preencha nome, email e telefone.");
    return;
  }

  const itens = carrinho.map(i => ({ id: i.id, quantidade: i.quantidade }));

  try {
    const res = await fetch(`${API_URL}/api/criar-pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente, itens })
    });

    const data = await res.json();
    if (!data.ok) {
      alert(data.erro || "Erro ao criar Pix.");
      return;
    }

    mostrarPix(data);
  } catch (err) {
    console.error(err);
    alert("Erro de conexão com o backend.");
  }
}

function mostrarPix(data) {
  document.getElementById("checkoutModal").classList.add("hidden");
  document.getElementById("overlay").classList.remove("hidden");
  document.getElementById("pixModal").classList.remove("hidden");

  document.getElementById("pixContent").innerHTML = `
    <div class="pix-box">
      <p>Pedido: <b>${data.pedidoId}</b></p>
      <p>Total: <b>${moeda(data.total)}</b></p>
      <img src="data:image/png;base64,${data.qrCodeBase64}" alt="QR Code Pix" />
      <textarea id="pixCode" readonly>${data.qrCode}</textarea>
      <button class="primary" onclick="copiarPix()">Copiar código Pix</button>
      <p id="pixStatus" class="notice">Aguardando pagamento...</p>
    </div>
  `;

  if (pagamentoTimer) clearInterval(pagamentoTimer);
  pagamentoTimer = setInterval(() => verificarPagamento(data.pagamentoId), 5000);
}

async function verificarPagamento(pagamentoId) {
  try {
    const res = await fetch(`${API_URL}/api/pagamento/${pagamentoId}`);
    const data = await res.json();

    if (data.status === "approved") {
      document.getElementById("pixStatus").textContent = "Pagamento aprovado! Pedido enviado.";
      clearInterval(pagamentoTimer);
      carrinho = [];
      salvarCarrinho();
      atualizarCarrinho();
      await carregarProdutos();
    } else {
      document.getElementById("pixStatus").textContent = `Status: ${data.status || "aguardando"}`;
    }
  } catch (err) {
    console.warn("Não foi possível verificar pagamento", err);
  }
}

async function copiarPix() {
  const code = document.getElementById("pixCode").value;
  await navigator.clipboard.writeText(code);
  alert("Código Pix copiado!");
}

carregarProdutos();
