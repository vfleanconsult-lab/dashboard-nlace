(function(global){
“use strict”;

var CSV_URL = “https://docs.google.com/spreadsheets/d/1bkKIE2dD_HCBevKrunZa–mQH9rfUCZV26OKug7QJPM/export?format=csv&gid=1320604970”;

function buildUrl(){
var ts = Math.floor(Date.now()/(15*60*1000));
return CSV_URL + “&_cb=” + ts;
}

var state = { rows:[], years:[], loaded:false, error:null, loadedAt:null };

function getTipo(row)      { return (row[“Tipo”] || “”).trim(); }
function getCuenta(row)    { return (row[“Cuenta_Cble”] || “”).trim(); }
function getDesc(row)      { return (row[“Descripcion Cta.”] || row[“Descripcion Cta”] || “”).trim(); }
function getClasGasto(row) { return (row[“Clasificacion_Gasto”] || “”).trim(); }
function getClasifCto(row) { return (row[“Clasificacion_Cto”] || “”).trim(); }
function getTipoCuenta(row){ return (row[“Tipo_Cuenta”] || “”).trim(); }
function getEstado(row)    { return (row[“Estado”] || “”).trim(); }
function getMesEco(row)    { return (row[“Mes_economico”] || “”).trim(); }
function getAnoEco(row)    { return (row[“Ano_eco”] || “”).trim(); }
function getFechaEmision(row){ return (row[“Fecha_emision”] || “”).trim(); }
function getFechaPago(row)   { return (row[“Fecha_Pago”] || “”).trim(); }

function getMonto(row){
var raw = String(row[“monto_bruto”] || “0”);
var cleaned = raw.replace(/./g,””).replace(/,/g,”.”).replace(/[^0-9.-]/g,””);
var n = parseFloat(cleaned);
return isNaN(n) ? 0 : n;
}

function getYear(row){
var ano = getAnoEco(row);
if(ano && /^\d{4}$/.test(ano)) return ano;
var mes = getMesEco(row);
if(mes && mes.length >= 4) return mes.substring(0,4);
return null;
}

function getMonth(row){
var mes = getMesEco(row);
if(!mes) return null;
return mes.length >= 7 ? mes.substring(0,7) : null;
}

function isVenta(row){ return getTipo(row) === “Ingreso” && getCuenta(row) === “5101-01”; }
function isOtroIngreso(row){ return getTipo(row) === “Ingreso” && getCuenta(row) !== “5101-01”; }
function isCosto(row){ return getTipo(row) === “Costo”; }

function isRetiroDirectores(row){
var desc  = getDesc(row).toLowerCase();
var clas  = getClasGasto(row).toLowerCase();
var cta   = getCuenta(row).toLowerCase();
return desc.indexOf(“retiro director”) !== -1 ||
clas.indexOf(“retiro director”) !== -1 ||
cta.indexOf(“retiro director”)  !== -1;
}

function isGasto(row){ return getTipo(row) === “Gasto” && !isRetiroDirectores(row); }

function filterByYear(rows, year){
if(!year || year === “all”) return rows;
return rows.filter(function(r){ return getYear(r) === String(year); });
}

function filterByMonth(rows, month){
return rows.filter(function(r){ return getMonth(r) === month; });
}

function sumMonto(rows){
return rows.reduce(function(acc,r){ return acc + getMonto(r); }, 0);
}

function groupByMonth(rows, filterFn){
var map = {};
rows.filter(filterFn).forEach(function(r){
var m = getMonth(r);
if(!m) return;
map[m] = (map[m] || 0) + getMonto(r);
});
return map;
}

function getMonthsForYear(rows, year){
var yr = String(year);
var set = {};
rows.forEach(function(r){
if(getYear(r) === yr){ var m = getMonth(r); if(m) set[m] = true; }
});
return Object.keys(set).sort();
}

var MONTH_LABELS = [“Ene”,“Feb”,“Mar”,“Abr”,“May”,“Jun”,“Jul”,“Ago”,“Sep”,“Oct”,“Nov”,“Dic”];

function monthLabel(yyyyMM){
var parts = yyyyMM.split(”-”);
if(parts.length < 2) return yyyyMM;
var idx = parseInt(parts[1],10) - 1;
return MONTH_LABELS[idx] || yyyyMM;
}

function formatCLP(n, compact){
var abs = Math.abs(n);
if(compact){
if(abs >= 1000000000) return “$” + (n/1000000000).toFixed(1) + “B”;
if(abs >= 1000000)    return “$” + (n/1000000).toFixed(1) + “M”;
if(abs >= 1000)       return “$” + (n/1000).toFixed(0) + “K”;
}
return “$” + Math.round(n).toLocaleString(“es-CL”);
}

function formatPct(n){ return (n*100).toFixed(1) + “%”; }
function formatDays(n){ return Math.round(n) + “ dias”; }

function loadData(onSuccess, onError){
if(state.loaded){ onSuccess(state.rows, state.years); return; }
Papa.parse(buildUrl(),{
download:true, header:true, skipEmptyLines:true,
complete:function(result){
state.rows = result.data.filter(function(r){
var t = getTipo(r);
return t === “Ingreso” || t === “Costo” || t === “Gasto”;
});
var ym = {};
state.rows.forEach(function(r){ var y = getYear(r); if(y) ym[y]=true; });
state.years = Object.keys(ym).sort().reverse();
state.loaded = true;
state.loadedAt = new Date();
onSuccess(state.rows, state.years);
},
error:function(err){ state.error=err; onError(err); }
});
}

function invalidateCache(){ state.rows=[]; state.years=[]; state.loaded=false; state.error=null; }

function calcKPIs(rows){
var ventas        = sumMonto(rows.filter(isVenta));
var otrosIngresos = sumMonto(rows.filter(isOtroIngreso));
var costos        = sumMonto(rows.filter(isCosto));
var gastos        = sumMonto(rows.filter(isGasto));
var utilBruta     = ventas - costos;
var utilOp        = utilBruta - gastos;
var margenOp      = ventas > 0 ? utilOp/ventas : 0;
var margenBruto   = ventas > 0 ? utilBruta/ventas : 0;
return { ventas:ventas, otrosIngresos:otrosIngresos, costos:costos, gastos:gastos,
utilBruta:utilBruta, utilOp:utilOp, margenOp:margenOp, margenBruto:margenBruto };
}

function parseDateCL(str){
if(!str) return null;
var s = str.trim();
if(/^\d{2}-\d{2}-\d{4}$/.test(s)){ var p=s.split(”-”); return new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0])); }
if(/^\d{4}-\d{2}-\d{2}/.test(s)){ return new Date(s.substring(0,10)); }
if(/^\d{2}/\d{2}/\d{4}$/.test(s)){ var p2=s.split(”/”); return new Date(parseInt(p2[2]),parseInt(p2[1])-1,parseInt(p2[0])); }
var dt = new Date(s);
return isNaN(dt.getTime()) ? null : dt;
}

function calcDSO(rows){
var con = rows.filter(function(r){ return isVenta(r) && getFechaEmision(r) && getFechaPago(r); });
if(con.length === 0) return null;
var total=0, count=0;
con.forEach(function(r){
var emi=parseDateCL(getFechaEmision(r)), pago=parseDateCL(getFechaPago(r));
if(emi && pago && pago>=emi){ total+=(pago-emi)/86400000; count++; }
});
return count > 0 ? total/count : null;
}

function calcDSOByCliente(rows){
var map = {};
rows.filter(function(r){ return isVenta(r) && getFechaEmision(r) && getFechaPago(r); })
.forEach(function(r){
var c=getDesc(r)||getCuenta(r);
var emi=parseDateCL(getFechaEmision(r)), pago=parseDateCL(getFechaPago(r));
if(!emi||!pago||pago<emi) return;
var diff=(pago-emi)/86400000;
if(!map[c]) map[c]={dias:0,count:0,monto:0};
map[c].dias+=diff; map[c].count+=1; map[c].monto+=getMonto(r);
});
return Object.keys(map).map(function(c){
return {cliente:c, dsoDias:map[c].dias/map[c].count, transacciones:map[c].count, monto:map[c].monto};
}).sort(function(a,b){ return b.dsoDias-a.dsoDias; });
}

function groupCostosByClasif(rows){
var map={};
rows.filter(isCosto).forEach(function(r){
var c=getClasifCto(r)||getClasGasto(r)||“Sin clasificar”;
map[c]=(map[c]||0)+getMonto(r);
});
return map;
}

function groupGastosByClasif(rows){
var map={};
rows.filter(isGasto).forEach(function(r){
var c=getClasGasto(r)||getClasifCto(r)||“Sin clasificar”;
map[c]=(map[c]||0)+getMonto(r);
});
return map;
}

global.NLaceData = {
loadData:loadData, invalidateCache:invalidateCache,
getState:function(){ return {rows:state.rows,years:state.years,loaded:state.loaded,loadedAt:state.loadedAt}; },
getTipo:getTipo, getCuenta:getCuenta, getDesc:getDesc,
getClasGasto:getClasGasto, getClasifCto:getClasifCto,
getTipoCuenta:getTipoCuenta, getEstado:getEstado,
getMonto:getMonto, getMesEco:getMesEco, getAnoEco:getAnoEco,
getYear:getYear, getMonth:getMonth,
getFechaEmision:getFechaEmision, getFechaPago:getFechaPago,
isVenta:isVenta, isOtroIngreso:isOtroIngreso,
isCosto:isCosto, isGasto:isGasto, isRetiroDirectores:isRetiroDirectores,
filterByYear:filterByYear, filterByMonth:filterByMonth,
sumMonto:sumMonto, groupByMonth:groupByMonth,
getMonthsForYear:getMonthsForYear, monthLabel:monthLabel,
formatCLP:formatCLP, formatPct:formatPct, formatDays:formatDays,
calcKPIs:calcKPIs, calcDSO:calcDSO, calcDSOByCliente:calcDSOByCliente,
groupCostosByClasif:groupCostosByClasif, groupGastosByClasif:groupGastosByClasif,
parseDateCL:parseDateCL, MONTH_LABELS:MONTH_LABELS
};

})(window);