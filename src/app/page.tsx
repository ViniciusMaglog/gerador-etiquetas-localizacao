"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import bwipjs from 'bwip-js';

// Interface para os dados do CSV
interface CsvRow {
  LOCALIZACAO: string; // O código da localização (ex: A-01-05)
  QUANTIDADE?: string; // Opcional, se quiser imprimir mais de uma da mesma
}

export default function HomePage() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  // Lida com o upload do arquivo
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setError('Por favor, selecione um arquivo .csv');
        return;
      }
      
      setFileName(file.name);
      setError('');

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: ";", // Importante: Excel em PT-BR geralmente usa ponto e vírgula
        complete: (results: any) => {
          // Verifica colunas obrigatórias
          const fileColumns = results.meta.fields || [];
          if (!fileColumns.includes('LOCALIZACAO')) {
            setError('O arquivo CSV deve conter a coluna: LOCALIZACAO');
            setCsvData([]);
            return;
          }

          setCsvData(results.data);
        },
        error: (err: any) => {
          setError(`Erro ao ler o arquivo: ${err.message}`);
        }
      });
    }
  };

  // Função para baixar o modelo de CSV
  const downloadTemplate = () => {
    // \uFEFF é para o Excel reconhecer os acentos corretamente
    const csvContent = "\uFEFFLOCALIZACAO;QUANTIDADE\n" +
                       "A-01-01;1\n" + 
                       "A-01-02;2\n" + 
                       "B-05-10;1";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_localizacao.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Função Principal: Gerar PDF
  const generatePDF = async () => {
    if (csvData.length === 0) {
      setError("Nenhum dado para gerar.");
      return;
    }
    setLoading(true);
    setError('');

    // Configuração do PDF: 100mm x 70mm
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [100, 70], 
    });

    // Função auxiliar para gerar a imagem do código de barras
    const generateBarcodeImage = (text: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        try {
          bwipjs.toCanvas(canvas, {
            bcid: 'code128',       // Tipo do código de barras
            text: text,            // Texto
            scale: 3,              // Escala (resolução)
            height: 15,            // Altura relativa
            includetext: false,    // Não incluir texto pelo plugin (vamos desenhar manualmente no PDF)
            textxalign: 'center',
          });
          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      });
    };

    let isFirstPage = true;

    for (const row of csvData) {
        // Se não tiver quantidade, assume 1
        const quantity = parseInt(row.QUANTIDADE || '1', 10);
        const code = row.LOCALIZACAO;

        if (!code) continue;

        try {
            const barcodeImg = await generateBarcodeImage(code);
            
            for (let i = 0; i < quantity; i++) {
                if (!isFirstPage) doc.addPage();
                isFirstPage = false;

                const pageW = 100;
                const pageH = 70;
                const centerX = pageW / 2;

                // Desenha borda externa (opcional, ajuda no corte)
                doc.setLineWidth(0.5);
                doc.rect(2, 2, pageW - 4, pageH - 4);

                // 1. Título "LOCALIZAÇÃO"
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(14);
                doc.text("IDENTIFICAÇÃO DE INVENTÁRIO", centerX, 10, { align: 'center' });

                // 2. Imagem do Código de Barras (Centralizada)
                // x, y, width, height
                doc.addImage(barcodeImg, 'PNG', 10, 15, 80, 20);

                // 3. O Código escrito abaixo (Bem grande)
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(14); // Fonte bem grande para leitura fácil de longe
                doc.text(code, centerX, 42, { align: 'center' });
            }
        } catch (e) {
            console.error("Erro ao gerar barcode para", code, e);
            continue; 
        }
    }

    doc.save("etiquetas_localizacao.pdf");
    setLoading(false);
  };
  
  return (
    <div className="bg-slate-900 min-h-screen flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 border border-slate-700">
            <div className='text-center'>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">Etiquetas de Localização</h1>
                <p className="text-slate-400 mt-2 text-sm">Gera etiquetas 100x70mm para endereçamento de estoque.</p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {error}
                </div>
            )}
            
            <div className="space-y-4">
                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 border-dashed hover:border-emerald-500 transition-colors group">
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                        <svg className="w-10 h-10 text-slate-400 group-hover:text-emerald-400 mb-3 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white">
                            {fileName ? fileName : 'Clique para selecionar o CSV'}
                        </span>
                        <input id="file-upload" type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                    </label>
                </div>

                <div className='grid grid-cols-2 gap-3'>
                    <button 
                        onClick={downloadTemplate} 
                        className="flex items-center justify-center bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-4 rounded-lg transition-all text-sm"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        Modelo CSV
                    </button>

                    <button 
                        onClick={generatePDF} 
                        disabled={loading || csvData.length === 0} 
                        className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                    >
                        {loading ? 'Gerando...' : 'Gerar PDF'}
                    </button>
                </div>
            </div>
            
            <div className="text-center text-xs text-slate-500">
                <p>O arquivo deve ter a coluna: <strong>LOCALIZACAO</strong></p>
            </div>
        </div>
    </div>
  );
}