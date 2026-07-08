"use client";

import React, { useState } from 'react';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import bwipjs from 'bwip-js';

interface CsvRow {
  LOCALIZACAO: string;
  QUANTIDADE?: string;
}

export default function HomePage() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [manualLocation, setManualLocation] = useState('');

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
        delimiter: ";",
        complete: (results: any) => {
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

  const downloadTemplate = () => {
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
  
  const generatePDF = async () => {
    let dataToProcess: CsvRow[] = [];
    
    if (manualLocation.trim() !== '') {
      dataToProcess = [{ LOCALIZACAO: manualLocation.trim().toUpperCase(), QUANTIDADE: '1' }];
    } else {
      dataToProcess = csvData;
    }

    if (dataToProcess.length === 0) {
      setError("Insira uma localização manual ou carregue um arquivo CSV.");
      return;
    }
    
    setLoading(true);
    setError('');

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [100, 70], 
    });

    const generateBarcodeImage = (text: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        try {
          bwipjs.toCanvas(canvas, {
            bcid: 'code128',
            text: text,
            scale: 3,
            height: 30,
            includetext: false,
            textxalign: 'center',
          });
          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      });
    };

    let isFirstPage = true;

    for (const row of dataToProcess) {
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

                // Desenha a borda externa
                doc.setLineWidth(0.8);
                doc.rect(2, 2, pageW - 4, pageH - 4);

                const maxTextWidthMM = 84;
                const scaleX = 1.15; 
                doc.setFont("Helvetica", "bold");
                
                let fontSize = 42;
                doc.setFontSize(fontSize);
                
                let textWidthMM = (doc.getStringUnitWidth(code) * fontSize * 0.352778) * scaleX;
                
                while (textWidthMM > maxTextWidthMM && fontSize > 12) {
                    fontSize -= 1;
                    doc.setFontSize(fontSize);
                    textWidthMM = (doc.getStringUnitWidth(code) * fontSize * 0.352778) * scaleX;
                }

                const currentY = 22;
                const startX = centerX - (textWidthMM / 2);

                // 1. Renderiza o texto principal do topo
                doc.text(code, startX, currentY, { horizontalScale: scaleX });

                // 2. Imagem do Código de Barras centralizada (Aproveitando melhor o espaço inferior) left: 8, top: 34, width: 84, height: 28
                doc.addImage(barcodeImg, 'PNG', 8, 34, 84, 32);
            }
        } catch (e) {
            console.error("Erro ao gerar barcode", e);
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
                <h1 className="text-3xl text-white tracking-tight">Gerador de Etiqueta Palete</h1>
                <p className="text-slate-400 mt-2 text-sm">Layout 100x70mm</p>
            </div>

            <div className="space-y-2">
                <label htmlFor="manual-input" className="text-sm font-semibold text-slate-300 block">
                    Digitar Localização Manual 
                </label>
                <input
                    id="manual-input"
                    type="text"
                    placeholder="Ex: A-01-05"
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-bold uppercase transition-colors"
                />
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    {error}
                </div>
            )}
            
            <div className="space-y-4">
                <div className={`p-4 bg-slate-700/50 rounded-lg border border-dashed transition-colors group ${manualLocation.trim() ? 'border-slate-700 opacity-40' : 'border-slate-600 hover:border-emerald-500'}`}>
                    <label htmlFor="file-upload" className={`flex flex-col items-center justify-center w-full h-full ${manualLocation.trim() ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <svg className="w-10 h-10 text-slate-400 group-hover:text-emerald-400 mb-3 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white text-center">
                            {fileName ? fileName : 'Clique para carregar o arquivo CSV'}
                        </span>
                        <input id="file-upload" type="file" accept=".csv" onChange={handleFileUpload} disabled={manualLocation.trim() !== ''} className="hidden" />
                    </label>
                </div>

                <div className='grid grid-cols-2 gap-3'>
                    <button 
                        onClick={downloadTemplate} 
                        className="flex items-center justify-center bg-slate-600 hover:bg-slate-500 text-white font-semibold py-3 px-4 rounded-lg transition-all text-sm"
                    >
                        Modelo CSV
                    </button>

                    <button 
                        onClick={generatePDF} 
                        disabled={loading || (csvData.length === 0 && manualLocation.trim() === '')} 
                        className="flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg"
                    >
                        {loading ? 'Processando...' : 'Gerar PDF'}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}