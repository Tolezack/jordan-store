const API_URL = "https://SEU-BACKEND.onrender.com";

let produtos = [];
let carrinho = [];
let currentCategory = "all";
let clienteInfo = { nome:"", telefone:"", email:"", endereco:"", numero:"", bairro:"", frete:9.90 };

function money(v){return `R$ ${Number(v||0).toFixed(2).replace(".",",")}`}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function setApiStatus(t,c){const e=document.getElementById("apiStatus"); if(e){e.textContent=t;e.className=`api-status ${c||""}`}}

async function carregarProdutos(){
  setApiStatus("conectando...","");
  try{
    const r=await fetch(`${API_URL}/api/produtos`);
    const d=await r.json();
    if(!r.ok||!d.produtos) throw new Error(d.erro||"Resposta inválida do backend");
    produtos=d.produtos.map(p=>({...p,estoque:Number(p.estoque||0),preco:Number(p.preco||0),imagens:Array.isArray(p.imagens)?p.imagens:[]}));
    localStorage.setItem("jordanstore_produtos_cache",JSON.stringify(produtos));
    setApiStatus("online","ok");
    init();
  }catch(e){
    console.error(e); setApiStatus("erro na API","err");
    const cache=localStorage.getItem("jordanstore_produtos_cache");
    if(cache){produtos=JSON.parse(cache); init(); showNotification("API offline: carreguei do cache.","warning"); return}
    document.getElementById("allProducts").innerHTML=`<div class="loading"><h3>Erro ao carregar produtos</h3><p>Confira API_URL e /api/produtos.</p><button class="copy" onclick="carregarProdutos()">Tentar novamente</button></div>`;
  }
}

function init(){loadCart();loadClienteInfo();renderAllProducts();updateCartDisplay();startBannerRotation();setupEventListeners()}
function renderAllProducts(){filterByCategory(currentCategory||"all")}
function filterByCategory(cat){
  currentCategory=cat;
  document.querySelectorAll(".tab,.side-link").forEach(b=>{b.classList.remove("active"); if((b.getAttribute("onclick")||"").includes(`'${cat}'`)) b.classList.add("active")});
  const list=cat==="all"?produtos:produtos.filter(p=>p.categoria===cat);
  renderProducts(list);
}
function renderProducts(list){
  const c=document.getElementById("allProducts");
  if(!list.length){c.innerHTML=`<div class="loading"><h3>Nenhum produto encontrado</h3></div>`;return}
  c.innerHTML=list.map(p=>{
    const cls=p.estoque===0?"stock-out":p.estoque<=3?"stock-low":p.estoque<=10?"stock-medium":"stock-high";
    const txt=p.estoque===0?"ESGOTADO":p.estoque<=3?`ÚLTIMAS ${p.estoque}`:p.estoque<=10?"ESTOQUE BAIXO":"EM ESTOQUE";
    return `<article class="product-card">${p.estoque<=3&&p.estoque>0?`<div class="product-badge">ÚLTIMAS</div>`:""}<div class="product-image-container"><img src="${p.imagem}" alt="${esc(p.nome)}" class="product-image" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Produto'"></div><div class="product-info"><h3 class="product-name">${esc(p.nome)}</h3><div class="product-price">${money(p.preco)}</div><div class="stock-info ${cls}">${txt}</div><div class="product-buttons">${p.estoque>0?`<button class="product-btn buy-btn" data-id="${p.id}">Comprar</button>`:`<button class="product-btn disabled-btn" disabled>Esgotado</button>`}<button class="product-btn details-btn" data-id="${p.id}">Detalhes</button></div></div></article>`;
  }).join("");
}
function searchProducts(){const t=(document.getElementById("searchInput").value||"").toLowerCase().trim();let l=produtos.filter(p=>currentCategory==="all"||p.categoria===currentCategory);if(t)l=l.filter(p=>String(p.nome||"").toLowerCase().includes(t)||String(p.descricao||"").toLowerCase().includes(t));renderProducts(l)}
function sortProducts(){const s=document.getElementById("sortSelect").value;let l=produtos.filter(p=>currentCategory==="all"||p.categoria===currentCategory);if(s==="price-asc")l.sort((a,b)=>a.preco-b.preco);if(s==="price-desc")l.sort((a,b)=>b.preco-a.preco);if(s==="name-asc")l.sort((a,b)=>a.nome.localeCompare(b.nome));if(s==="stock")l.sort((a,b)=>b.estoque-a.estoque);renderProducts(l)}

function addToCart(id){const p=produtos.find(x=>x.id===id);if(!p)return showNotification("Produto não encontrado.","error");if(p.estoque<=0)return showNotification("Produto esgotado.","error");const i=carrinho.find(x=>x.id===id);if(i){if(i.quantidade>=p.estoque)return showNotification("Quantidade máxima no estoque.","warning");i.quantidade++}else carrinho.push({id:p.id,nome:p.nome,preco:p.preco,quantidade:1,imagem:p.imagem});saveCart();updateCartDisplay();showNotification(`${p.nome} adicionado.`,"success")}
function updateCartItem(id,ch){const idx=carrinho.findIndex(i=>i.id===id);if(idx<0)return;const p=produtos.find(x=>x.id===id);const q=carrinho[idx].quantidade+ch;if(q<1)carrinho.splice(idx,1);else if(p&&q<=p.estoque)carrinho[idx].quantidade=q;else return showNotification("Estoque insuficiente.","warning");saveCart();updateCartDisplay()}
function removeFromCart(id){carrinho=carrinho.filter(i=>i.id!==id);saveCart();updateCartDisplay()}
function clearCart(){if(confirm("Limpar carrinho?")){carrinho=[];saveCart();updateCartDisplay()}}
function saveCart(){localStorage.setItem("jordanstore_cart",JSON.stringify(carrinho))}
function loadCart(){try{carrinho=JSON.parse(localStorage.getItem("jordanstore_cart")||"[]");carrinho=carrinho.filter(i=>produtos.some(p=>p.id===i.id))}catch{carrinho=[]}}

function updateCartDisplay(){
  document.querySelector(".cart-count").textContent=carrinho.reduce((s,i)=>s+i.quantidade,0);
  const items=document.getElementById("cartItems"), sum=document.getElementById("cartSummary"), chk=document.getElementById("checkoutBtn"), clr=document.getElementById("clearCartBtn");
  if(!carrinho.length){items.innerHTML=`<div class="empty-cart"><div>🛍️</div><p>Seu carrinho está vazio</p></div>`;sum.style.display=chk.style.display=clr.style.display="none";return}
  sum.style.display="grid";chk.style.display=clr.style.display="block";
  items.innerHTML=carrinho.map(i=>{const p=produtos.find(x=>x.id===i.id);const max=p?p.estoque:0;return `<div class="cart-item"><img src="${i.imagem}" class="cart-item-image" onerror="this.src='https://via.placeholder.com/80'"><div><div class="cart-item-name">${esc(i.nome)}</div><div class="cart-item-price">${money(i.preco*i.quantidade)}</div><div class="cart-item-actions"><div class="quantity-control"><button class="quantity-btn" onclick="updateCartItem('${i.id}',-1)">-</button><span>${i.quantidade}</span><button class="quantity-btn" onclick="updateCartItem('${i.id}',1)" ${i.quantidade>=max?"disabled":""}>+</button></div><button class="remove-item" onclick="removeFromCart('${i.id}')">Remover</button></div></div></div>`}).join("");
  const subtotal=carrinho.reduce((s,i)=>s+i.preco*i.quantidade,0), frete=Number(clienteInfo.frete||9.90);
  document.getElementById("cartSubtotal").textContent=money(subtotal);document.getElementById("cartShipping").textContent=money(frete);document.getElementById("cartTotal").textContent=money(subtotal+frete);
}

function openCheckout(){
  if(!carrinho.length)return showNotification("Carrinho vazio.","warning");
  const subtotal=carrinho.reduce((s,i)=>s+i.preco*i.quantidade,0), total=subtotal+Number(clienteInfo.frete||9.90);
  document.getElementById("checkoutForm").innerHTML=`<form onsubmit="finalizarPedido(event)"><div class="form-group"><label>Nome completo *</label><input id="nome" required value="${esc(clienteInfo.nome)}"></div><div class="form-group"><label>WhatsApp *</label><input id="telefone" required value="${esc(clienteInfo.telefone)}"></div><div class="form-group"><label>E-mail * <small>(Pix automático)</small></label><input id="email" type="email" required value="${esc(clienteInfo.email)}"></div><div class="form-group"><label>Endereço *</label><input id="endereco" required value="${esc(clienteInfo.endereco)}"></div><div style="display:grid;grid-template-columns:1fr 2fr;gap:10px"><div class="form-group"><label>Número *</label><input id="numero" required value="${esc(clienteInfo.numero)}"></div><div class="form-group"><label>Bairro</label><input id="bairro" value="${esc(clienteInfo.bairro)}"></div></div><div class="form-group"><label>Observação</label><textarea id="observacao" placeholder="Tamanho, complemento..."></textarea></div><div class="order-summary"><h4>Resumo</h4>${carrinho.map(i=>`<div class="order-item"><span>${esc(i.nome)} x${i.quantidade}</span><b>${money(i.preco*i.quantidade)}</b></div>`).join("")}<div class="order-item"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="order-item"><span>Frete</span><b>${money(clienteInfo.frete)}</b></div><div class="order-total"><span>Total</span><b>${money(total)}</b></div></div><button class="submit" type="submit">Gerar Pix</button></form>`;
  document.getElementById("checkoutModal").classList.add("active");document.getElementById("cartModal").classList.remove("active");
}
function closeCheckout(){document.getElementById("checkoutModal").classList.remove("active")}

async function finalizarPedido(e){
  e.preventDefault();
  clienteInfo.nome=document.getElementById("nome").value.trim();clienteInfo.telefone=document.getElementById("telefone").value.trim();clienteInfo.email=document.getElementById("email").value.trim();clienteInfo.endereco=document.getElementById("endereco").value.trim();clienteInfo.numero=document.getElementById("numero").value.trim();clienteInfo.bairro=document.getElementById("bairro").value.trim();saveClienteInfo();
  const btn=e.target.querySelector("button[type='submit']");btn.disabled=true;btn.textContent="Gerando Pix...";
  try{
    const r=await fetch(`${API_URL}/api/criar-pix`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cliente:{nome:clienteInfo.nome,telefone:clienteInfo.telefone,email:clienteInfo.email,endereco:`${clienteInfo.endereco}, ${clienteInfo.numero} - ${clienteInfo.bairro}`,observacao:document.getElementById("observacao").value||""},itens:carrinho.map(i=>({id:i.id,quantidade:i.quantidade}))})});
    const d=await r.json(); if(!r.ok||!d.ok)throw new Error(d.erro||"Erro ao gerar Pix");
    closeCheckout();mostrarPix(d);
  }catch(err){console.error(err);showNotification(err.message||"Erro ao gerar Pix.","error")}finally{btn.disabled=false;btn.textContent="Gerar Pix"}
}
function mostrarPix(d){
  const m=document.getElementById("detailsModal");
  m.innerHTML=`<div class="modal-card"><div class="modal-head"><h3>Pagamento Pix</h3><button onclick="closeModal('detailsModal')">×</button></div><div class="pix-box"><p>Pedido: <b>${esc(d.pedidoId)}</b></p><p>Total: <b>${money(d.total)}</b></p>${d.qrCodeBase64?`<img src="data:image/png;base64,${d.qrCodeBase64}" alt="QR Code Pix">`:""}<textarea readonly id="pixCode">${d.qrCode||""}</textarea><button class="copy" onclick="copiarPix()">Copiar código Pix</button>${d.ticketUrl?`<button class="copy" onclick="window.open('${d.ticketUrl}','_blank')">Abrir no Mercado Pago</button>`:""}<p style="margin-top:14px;color:#777;font-size:14px">Após pagar, o Mercado Pago avisa o backend. O backend baixa estoque e manda Discord.</p><button class="close-light" onclick="closeModal('detailsModal')">Fechar</button></div></div>`;
  m.classList.add("active");
}
function copiarPix(){navigator.clipboard.writeText(document.getElementById("pixCode").value);showNotification("Código Pix copiado.","success")}
function showProductDetails(id){const p=produtos.find(x=>x.id===id);if(!p)return;const m=document.getElementById("detailsModal");m.innerHTML=`<div class="modal-card"><div class="modal-head"><h3>Detalhes</h3><button onclick="closeModal('detailsModal')">×</button></div><div class="modal-body"><img src="${p.imagem}" style="width:100%;max-height:330px;object-fit:cover;border-radius:20px" onerror="this.src='https://via.placeholder.com/600x400'"><h2 style="margin-top:16px">${esc(p.nome)}</h2><div class="product-price">${money(p.preco)}</div><p style="color:#666">${esc(p.descricao||"Sem descrição.")}</p><p style="margin-top:12px"><b>Estoque:</b> ${p.estoque}</p>${p.estoque>0?`<button class="copy" onclick="addToCart('${p.id}');closeModal('detailsModal')">Adicionar ao carrinho</button>`:`<button class="copy" disabled style="background:#ccc">Produto esgotado</button>`}</div></div>`;m.classList.add("active")}
function closeModal(id){document.getElementById(id).classList.remove("active")}
function toggleCart(){document.getElementById("cartModal").classList.toggle("active")}
function toggleSidebar(){document.getElementById("sidebar").classList.toggle("active");document.querySelector(".overlay").classList.toggle("active")}
function scrollToProducts(){document.getElementById("produtos").scrollIntoView({behavior:"smooth"})}
function startBannerRotation(){let cur=0;const b=document.querySelectorAll(".banner"),d=document.querySelectorAll(".dot");if(!b.length)return;setInterval(()=>{cur=(cur+1)%b.length;b.forEach((x,i)=>x.classList.toggle("active",i===cur));d.forEach((x,i)=>x.classList.toggle("active",i===cur))},5000)}
function goToBannerSlide(i){document.querySelectorAll(".banner").forEach((b,n)=>b.classList.toggle("active",n===i));document.querySelectorAll(".dot").forEach((d,n)=>d.classList.toggle("active",n===i))}
function setupEventListeners(){document.addEventListener("click",e=>{const buy=e.target.closest(".buy-btn"),det=e.target.closest(".details-btn");if(buy)addToCart(buy.dataset.id);if(det)showProductDetails(det.dataset.id)})}
function loadClienteInfo(){try{clienteInfo={...clienteInfo,...JSON.parse(localStorage.getItem("jordanstore_cliente")||"{}")}}catch{}}
function saveClienteInfo(){localStorage.setItem("jordanstore_cliente",JSON.stringify(clienteInfo))}
function showNotification(msg,type="success"){const n=document.createElement("div");n.className=`notification ${type}`;n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),3100)}
document.addEventListener("DOMContentLoaded",carregarProdutos);
