(function(global){
"use strict";

var NAV_ITEMS = [
  { href:"index.html",     label:"Resumen Ejecutivo" },
  { href:"ingresos.html",  label:"Ingresos" },
  { href:"costos.html",    label:"Costos" },
  { href:"gastos.html",    label:"Gastos" },
  { href:"cobranzas.html", label:"Cobranzas" }
];

function currentPage(){
  var path = window.location.pathname.split("/").pop() || "index.html";
  return path;
}

function renderSidebar(){
  var active = currentPage();
  var items = NAV_ITEMS.map(function(item){
    var isActive = item.href === active;
    return "<a href=\""+item.href+"\" class=\""+(isActive?"active":"")+"\">"+item.label+"</a>";
  }).join("");

  return "<nav class=\"sidebar\">"+
    "<div class=\"sidebar-logo\">"+
      "<div class=\"brand\">NL<span>ace</span></div>"+
      "<div class=\"tagline\">Financial Intelligence</div>"+
    "</div>"+
    "<div class=\"sidebar-year-badge\">"+
      "<span class=\"label\">Periodo</span>"+
      "<span class=\"year\" id=\"sidebar-active-year\">-</span>"+
    "</div>"+
    "<div class=\"sidebar-section-label\">Vistas</div>"+
    "<div class=\"sidebar-nav\">"+items+"</div>"+
    "<div class=\"sidebar-footer\">"+
      "<div class=\"data-status\">"+
        "<span class=\"status-dot loading\" id=\"status-dot\"></span>"+
        "<span id=\"status-text\">Cargando datos...</span>"+
      "</div>"+
    "</div>"+
  "</nav>";
}

function renderPageHeader(title, subtitle){
  return "<header class=\"page-header\">"+
    "<div class=\"page-header-left\">"+
      "<h1 class=\"page-title\">"+title+"</h1>"+
      "<span class=\"page-subtitle\">"+subtitle+"</span>"+
    "</div>"+
    "<div class=\"header-controls\">"+
      "<div class=\"year-filter\">"+
        "<label>Ano</label>"+
        "<select id=\"year-select\" onchange=\"NLaceUI.onYearChange(this.value)\">"+
          "<option value=\"all\">Todos</option>"+
        "</select>"+
      "</div>"+
      "<span class=\"last-updated\" id=\"last-updated\"></span>"+
    "</div>"+
  "</header>";
}

function setDataStatus(st, text){
  var dot  = document.getElementById("status-dot");
  var span = document.getElementById("status-text");
  if(!dot||!span) return;
  dot.className = "status-dot "+st;
  span.textContent = text;
}

function populateYearSelector(years){
  var sel = document.getElementById("year-select");
  if(!sel) return;
  years.forEach(function(y){
    var opt = document.createElement("option");
    opt.value = y; opt.textContent = y;
    sel.appendChild(opt);
  });
  if(years.length > 0) sel.value = years[0];
}

function setActiveYear(year){
  var badge = document.getElementById("sidebar-active-year");
  if(badge) badge.textContent = year || "-";
  var sel = document.getElementById("year-select");
  if(sel && year) sel.value = String(year);
}

function setLastUpdated(date){
  var el = document.getElementById("last-updated");
  if(!el||!date) return;
  var fmt = date.toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"});
  el.textContent = "Act. "+fmt;
}

function showLoading(containerId){
  var el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = "<div class=\"loading-overlay\"><div class=\"loading-spinner\"></div><div class=\"loading-text\">Procesando datos...</div></div>";
}

function showError(containerId, msg){
  var el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = "<div class=\"error-card\"><h3>Error al cargar datos</h3><p>"+(msg||"No se pudo conectar con la fuente de datos.")+"</p></div>";
}

function kpiCard(opts){
  return "<div class=\"kpi-card\">"+
    "<div class=\"kpi-label\">"+
      "<span class=\"kpi-dot\" style=\"background:"+(opts.dotColor||"var(--text-muted)")+"\"></span>"+
      opts.label+
    "</div>"+
    "<div class=\"kpi-value "+(opts.color||"white")+"\">"+opts.value+"</div>"+
    (opts.sub ? "<div class=\"kpi-sub\">"+opts.sub+"</div>" : "")+
  "</div>";
}

function tableRow(cells){
  var tds = cells.map(function(c,i){
    return "<td class=\""+(i===0?"primary":"")+"\">"+c+"</td>";
  }).join("");
  return "<tr>"+tds+"</tr>";
}

global.NLaceUI = {
  renderSidebar:renderSidebar,
  renderPageHeader:renderPageHeader,
  setDataStatus:setDataStatus,
  populateYearSelector:populateYearSelector,
  setActiveYear:setActiveYear,
  setLastUpdated:setLastUpdated,
  showLoading:showLoading,
  showError:showError,
  kpiCard:kpiCard,
  tableRow:tableRow,
  onYearChange:function(){}
};

})(window);