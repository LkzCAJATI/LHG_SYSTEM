import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Budget, Sale, ServiceOrder } from '../types';
import { format } from 'date-fns';

// Helper: Substituir placeholders nos modelos
const replacePlaceholders = (text: string, data: any) => {
  let result = text;
  Object.keys(data).forEach(key => {
    const value = data[key] || '';
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });
  return result;
};

// Helper: Desenhar Cabeçalho Padrão
const drawHeader = (doc: jsPDF, settings: any) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  if (settings.logo) {
    try {
      doc.addImage(settings.logo, 'PNG', 15, 10, 25, 25);
    } catch (e) {
      doc.setFontSize(22);
      doc.text('🎮', 15, 25);
    }
  } else {
    doc.setFontSize(22);
    doc.text('🎮', 15, 25);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(107, 33, 168); // Roxo
  doc.text(settings.systemName || 'LAN HOUSE GAMER', 45, 20);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  const companyInfo = [
    '📍 Endereço: Av. dos Trabalhadores, 59 - Centro - CAJATI/SP',
    '📞 Telefone: (13) 99684-5716  CNPJ: 59.521.108/0001-66'
  ];
  doc.text(companyInfo, 45, 26);

  doc.setLineWidth(1.5);
  doc.setDrawColor(190, 24, 110); // Rosa escuro (igual foto)
  doc.line(0, 38, pageWidth, 38);
};

export const generateOSPDF = async (os: ServiceOrder, settings: any, action: 'download' | 'print' = 'download') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  drawHeader(doc, settings);

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`ORDEM DE SERVIÇO Nº   ${os.externalId || os.id.substring(0, 8)}`, 40, 48);
  doc.text(`Data:    ${format(new Date(os.createdAt), 'dd/MM/yyyy')}`, pageWidth - 15, 48, { align: 'right' });

  // Dados do Cliente
  doc.setFillColor(107, 33, 168);
  doc.rect(15, 55, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('👤 DADOS DO CLIENTE', 18, 61);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ____________________________________________________________________________`, 15, 72);
  doc.text(`${os.customerName}`, 30, 71);
  doc.text(`CPF: _____________________________________   Telefone: __________________________________`, 15, 80);
  doc.text(`${os.customerCPF || ''}`, 28, 79);
  doc.text(`${os.customerPhone || ''}`, 95, 79);
  doc.text(`Declaro ser maior de 18 anos. ( ${os.isOver18 ? 'x' : ' '} ) Sim`, 15, 88);

  // Dados do Aparelho
  doc.setFillColor(107, 33, 168);
  doc.rect(15, 95, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('🎮💻 DADOS DO APARELHO', 18, 101);

  doc.setTextColor(0, 0, 0);
  const deviceCheck = (type: string) => os.deviceType === type ? '( x )' : '(   )';
  doc.text(`Tipo: ${deviceCheck('pc')} PC  ${deviceCheck('notebook')} Notebook  ${deviceCheck('console')} Console  ${deviceCheck('celular')} Celular`, 15, 110);
  doc.text(`Marca/Modelo: ____________________________________________________________________`, 15, 118);
  doc.text(`${os.deviceBrandModel}`, 45, 117);
  doc.text(`Nº de Série: _________________________________________________________________________`, 15, 126);
  doc.text(`${os.serialNumber}`, 38, 125);
  doc.text(`Estado físico (riscos, trincos, acessórios):`, 15, 134);
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, 137, pageWidth - 30, 20);
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(os.physicalState, pageWidth - 40), 18, 142);

  // Serviços
  doc.setFontSize(10);
  doc.setFillColor(107, 33, 168);
  doc.rect(15, 162, pageWidth - 30, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('🛠️ SERVIÇOS', 18, 168);

  doc.setTextColor(0, 0, 0);
  const services = ['Diagnóstico para identificar o problema', 'Formatação', 'Limpeza completa', 'Troca de pasta térmica', 'Atualização de drivers', 'Troca de peças'];
  let currentY = 177;
  services.forEach(s => {
    const checked = os.selectedServices.includes(s) ? '( x )' : '(   )';
    doc.text(`${checked} ${s}`, 15, currentY);
    currentY += 8;
  });

  // Assinaturas
  doc.line(15, 260, 90, 260);
  doc.text('Assinatura do Cliente', 52.5, 265, { align: 'center' });
  doc.line(pageWidth - 90, 260, pageWidth - 15, 260);
  doc.text('Assinatura da Loja', pageWidth - 52.5, 265, { align: 'center' });

  const fileName = `OS_${os.externalId || os.id.substring(0,6)}.pdf`;
  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};

export const generateBudgetPDF = async (budget: Budget, settings: any, action: 'download' | 'print' = 'download') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  drawHeader(doc, settings);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ORÇAMENTO E APROVAÇÃO DE SERVIÇO OU MONTAGEM', pageWidth/2, 48, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`ORDEM DE SERVIÇO Nº   ${budget.externalId || ''}`, 15, 60);
  doc.text(`Data Orçamento:   ${format(new Date(budget.createdAt), 'dd/MM/yyyy')}`, pageWidth - 15, 60, { align: 'right' });

  // Tabela
  autoTable(doc, {
    startY: 65,
    head: [['Descrição', 'VALOR', 'Total']],
    body: budget.items.map(i => [i.description, `R$ ${i.unitPrice.toFixed(2)}`, `R$ ${i.totalPrice.toFixed(2)}`]),
    theme: 'grid',
    headStyles: { fillColor: [107, 33, 168] },
    styles: { halign: 'center' },
    columnStyles: { 0: { halign: 'left', cellWidth: 100 } }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFillColor(107, 33, 168);
  doc.rect(pageWidth - 75, finalY - 5, 60, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL:   R$ ${budget.total.toFixed(2)}`, pageWidth - 45, finalY + 1.5, { align: 'center' });

  // Regras
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text('REGRAS DE ORÇAMENTO / CONSERTO', 15, finalY + 20);
  const rules = doc.splitTextToSize(settings.osTermsTemplate || '', pageWidth/2 - 20);
  doc.text(rules, 15, finalY + 25);

  doc.text('REGRAS DE PAGAMENTO', pageWidth/2 + 10, finalY + 20);
  const payRules = doc.splitTextToSize(settings.budgetRulesTemplate || '', pageWidth/2 - 20);
  doc.text(payRules, pageWidth/2 + 10, finalY + 25);

  const fileName = `Orcamento_${budget.externalId || budget.id.substring(0,6)}.pdf`;
  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};

export const generateContractPDF = async (sale: Sale, settings: any, type: 'venda' | 'compra' = 'venda') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  drawHeader(doc, settings);

  const template = type === 'venda' ? settings.saleContractTemplate : settings.purchaseContractTemplate;
  const data = {
    LOJA: settings.systemName || 'LAN HOUSE GAMER',
    CLIENTE: sale.customerName || '____________________',
    CPF: '____________________',
    OBJETO: sale.items.map(i => i.name).join(', '),
    VALOR_TOTAL: `R$ ${sale.total.toFixed(2)}`,
    FORMA_PAGAMENTO: sale.paymentMethod === 'installment' ? `Parcelado em ${sale.installments?.length}x` : sale.paymentMethod.toUpperCase()
  };

  const processedText = replacePlaceholders(template, data);
  const splitText = doc.splitTextToSize(processedText, pageWidth - 30);
  
  doc.setFontSize(10);
  doc.text(splitText, 15, 50);

  // Assinaturas no rodapé
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.line(15, pageHeight - 40, 90, pageHeight - 40);
  doc.text('Vendedor', 52.5, pageHeight - 35, { align: 'center' });
  doc.line(pageWidth - 90, pageHeight - 40, pageWidth - 15, pageHeight - 40);
  doc.text('Comprador', pageWidth - 52.5, pageHeight - 35, { align: 'center' });

  doc.save(`Contrato_${sale.id.substring(0,6)}.pdf`);
};

export const generateReceiptPDF = async (sale: Sale, settings: any, action: 'download' | 'print' = 'print') => {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a5' });
  
  // Linha divisória vertical
  doc.setLineDashPattern([2, 1], 0);
  doc.line(70, 0, 70, doc.internal.pageSize.getHeight());
  doc.setLineDashPattern([], 0);

  // Parte Esquerda (Recibo de Entrada)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Recibo de Entrada', 35, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Cliente: ${sale.customerName || 'Avulso'}`, 10, 25);
  doc.text(`Valor: R$ ${sale.total.toFixed(2)}`, 10, 35);
  doc.text(`Serviço: ${sale.items[0]?.name.substring(0,25)}...`, 10, 45);
  doc.line(10, 70, 60, 70);
  doc.text('Ass. Funcionário', 35, 75, { align: 'center' });
  doc.line(10, 90, 60, 90);
  doc.text('Ass. Cliente', 35, 95, { align: 'center' });

  // Parte Direita (Recibo Principal)
  if (settings.logo) doc.addImage(settings.logo, 'PNG', 75, 5, 20, 20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.systemName || 'LAN HOUSE GAMER', 100, 15);
  doc.setFontSize(7);
  doc.text('CNPJ: 59.521.108/0001-66', 100, 20);
  
  doc.setFontSize(10);
  doc.text(`Recebi de ____________________________ portador do CPF _________________`, 75, 40);
  doc.text(`${sale.customerName || ''}`, 95, 39);
  doc.text(`a importância de R$ ${sale.total.toFixed(2)} referente a ${sale.items[0]?.name}`, 75, 50);
  
  doc.text('Forma de pagamento:', 120, 70);
  doc.text(`( ${sale.paymentMethod === 'pix' ? 'x' : ' '} ) Pix  ( ${sale.paymentMethod === 'cash' ? 'x' : ' '} ) Dinheiro  ( ${sale.paymentMethod === 'card' ? 'x' : ' '} ) Cartão`, 120, 75, { align: 'center' });

  const fileName = `Recibo_${sale.id.substring(0,6)}.pdf`;
  if (action === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};

export const generateInstallmentBookletPDF = async (sale: Sale, settings: any) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  if (!sale.installments) return;

  sale.installments.forEach((inst, index) => {
    if (index > 0 && index % 3 === 0) doc.addPage();
    
    const yOffset = (index % 3) * 90;
    
    // Borda do canhoto
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, 10 + yOffset, 60, 80);
    
    // Borda do recibo
    doc.rect(75, 10 + yOffset, pageWidth - 85, 80);
    
    // Conteúdo Canhoto
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`PARCELA ${inst.number}/${sale.installments!.length}`, 15, 20 + yOffset);
    doc.setFont('helvetica', 'normal');
    doc.text(`Venc: ${format(new Date(inst.dueDate), 'dd/MM/yyyy')}`, 15, 30 + yOffset);
    doc.text(`Valor: R$ ${inst.amount.toFixed(2)}`, 15, 40 + yOffset);
    doc.text(`Venda: ${sale.id.substring(0,8)}`, 15, 50 + yOffset);
    
    // Conteúdo Principal
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.systemName || 'LAN HOUSE GAMER', 80, 22 + yOffset);
    doc.setFontSize(8);
    doc.text(`RECIBO DE PAGAMENTO - PARCELA ${inst.number}`, 80, 28 + yOffset);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Recebemos de: ${sale.customerName || '____________________________________'}`, 80, 40 + yOffset);
    doc.text(`A importância de: R$ ${inst.amount.toFixed(2)}`, 80, 50 + yOffset);
    doc.text(`Referente a parcela ${inst.number} da venda #${sale.id.substring(0,8)}`, 80, 60 + yOffset);
    doc.text(`Vencimento: ${format(new Date(inst.dueDate), 'dd/MM/yyyy')}`, 80, 70 + yOffset);
    
    doc.line(80, 85 + yOffset, 140, 85 + yOffset);
    doc.text('Assinatura do Recebedor', 110, 88 + yOffset, { align: 'center' });
    
    doc.setFontSize(6);
    doc.text('Não rasurar. Este recibo é a garantia de sua quitação.', 110, 5 + yOffset, { align: 'center' });
  });

  doc.save(`Carne_${sale.id.substring(0,6)}.pdf`);
};
