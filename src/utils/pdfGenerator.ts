import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Budget } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Extender o tipo jsPDF para incluir o plugin autoTable (necessário para TypeScript)
interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generateBudgetPDF = (budget: Budget, settings: any) => {
  const doc = new jsPDF() as jsPDFWithPlugin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const dateStr = format(new Date(budget.createdAt || Date.now()), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  // 1. Cabeçalho / Logo do Sistema
  if (settings.logo) {
    try {
      // Tentar adicionar o logo se for base64
      doc.addImage(settings.logo, 'PNG', 15, 10, 25, 25);
    } catch (e) {
      console.error('Error adding logo to PDF', e);
      // Fallback para ícone se falhar
      doc.setFontSize(22);
      doc.text('🎮', 15, 25);
    }
  } else {
    doc.setFontSize(22);
    doc.text('🎮', 15, 25);
  }

  // Nome da Empresa e Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(107, 33, 168); // Roxo (purple-800)
  doc.text(settings.systemName || 'LHG SYSTEM', 45, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Sistema de Gerenciamento da Lan House Gamer', 45, 26);

  // Informações da Empresa (Lado Direito)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const companyInfo = [
    'A. dos trabalhadores, 58 - Centro - CAJATI/SP',
    'Telefone / Whatsapp: (13) 99684-5716',
    'CNPJ: 59.521.188/0001-66'
  ];
  doc.text(companyInfo, pageWidth - 15, 18, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 38, pageWidth - 15, 38);

  // 2. Dados do Orçamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`ORÇAMENTO #${budget.id.toUpperCase().substring(0, 8)}`, 15, 48);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data de Emissão: ${dateStr}`, 15, 54);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`CLIENTE: ${budget.customerName || 'Consumidor Final'}`, 15, 62);

  // 3. Tabela de Itens
  const tableRows = budget.items.map((item, index) => [
    index + 1,
    item.description,
    item.quantity,
    `R$ ${item.unitPrice.toFixed(2)}`,
    `R$ ${item.totalPrice.toFixed(2)}`
  ]);

  doc.autoTable({
    startY: 70,
    head: [['#', 'DESCRIÇÃO DO PRODUTO / SERVIÇO', 'QTD', 'VALOR UNIT.', 'TOTAL']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [107, 33, 168], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // 4. Totais
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Subtotal:', pageWidth - 65, finalY);
  doc.text(`R$ ${budget.subtotal.toFixed(2)}`, pageWidth - 15, finalY, { align: 'right' });

  if (budget.discount > 0) {
    doc.setTextColor(200, 0, 0);
    doc.text('Desconto:', pageWidth - 65, finalY + 5);
    doc.text(`- R$ ${budget.discount.toFixed(2)}`, pageWidth - 15, finalY + 5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DO ORÇAMENTO:', pageWidth - 65, finalY + 15);
  doc.setTextColor(107, 33, 168);
  doc.text(`R$ ${budget.total.toFixed(2)}`, pageWidth - 15, finalY + 15, { align: 'right' });

  // 5. Observações e Notas
  if (budget.notes) {
    const notesY = finalY + 30;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('OBSERVAÇÕES:', 15, notesY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const splitNotes = doc.splitTextToSize(budget.notes, pageWidth - 30);
    doc.text(splitNotes, 15, notesY + 5);
  }

  // 6. Rodapé
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text('Orçamento válido por 7 dias a partir da data de emissão.', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Obrigado pela preferência!', pageWidth / 2, footerY + 5, { align: 'center' });

  // Nome do Arquivo
  const fileName = `Orcamento_${(budget.customerName || 'Cliente').replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyy')}.pdf`;

  // Salvar
  doc.save(fileName);
};
