import { useState } from 'react';
import { useStore } from '../store/useStore';
import { Product } from '../types';
import {
  Package, Plus, Edit, Trash2, AlertTriangle,
  Search, ArrowUp, ArrowDown, History, X, Camera
} from 'lucide-react';

/** Suporta chaves antigas / alternativas e evita fotos “sumidas” no JSON. */
function getProductImageSrc(product: Product): string | undefined {
  const p = product as Product & { imageUrl?: string; photo?: string; foto?: string };
  const raw = p.image || p.imageUrl || p.photo || p.foto;
  if (!raw || typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/** Reduz tamanho do base64 para caber melhor no disco/localStorage (JPEG ~85%). */
function fileToCompressedDataUrl(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas não disponível'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };
    img.src = url;
  });
}

export function Products() {
  const { products, stockMovements, addProduct, updateProduct, deleteProduct, adjustStock } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [imageProduct, setImageProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockType, setStockType] = useState<'entry' | 'adjustment'>('entry');

  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    category: '',
    price: '',
    cost: '',
    quantity: '',
    minStock: '5',
    image: '',
  });

  const categories = [...new Set(products.map(p => p.category))].filter(Boolean);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const lowStockProducts = products.filter(p => p.quantity <= p.minStock);

  const resetForm = () => {
    setFormData({
      barcode: '',
      name: '',
      category: '',
      price: '',
      cost: '',
      quantity: '',
      minStock: '5',
      image: '',
    });
    setEditingProduct(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedImage = formData.image?.trim() || undefined;
    const productData = {
      barcode: formData.barcode,
      name: formData.name,
      category: formData.category,
      price: Number(formData.price),
      cost: Number(formData.cost),
      quantity: Number(formData.quantity),
      minStock: Number(formData.minStock),
      image: normalizedImage,
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, productData);
    } else {
      addProduct(productData);
    }

    setShowModal(false);
    resetForm();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      barcode: product.barcode || '',
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      cost: product.cost.toString(),
      quantity: product.quantity.toString(),
      minStock: product.minStock.toString(),
      image: getProductImageSrc(product) || '',
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      deleteProduct(id);
    }
  };

  const handleStockAdjust = () => {
    if (!selectedProduct || !stockQuantity) return;

    adjustStock(selectedProduct.id, Number(stockQuantity), stockType);
    setShowStockModal(false);
    setSelectedProduct(null);
    setStockQuantity('');
  };

  const productMovements = selectedProduct
    ? stockMovements.filter(m => m.productId === selectedProduct.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estoque</h1>
          <p className="text-gray-500">Gerencie produtos e controle de estoque</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      {/* Alertas de Estoque Baixo */}
      {lowStockProducts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-700 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Produtos com estoque baixo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockProducts.map(p => (
              <span key={p.id} className="px-3 py-1 bg-yellow-100 rounded-full text-sm">
                {p.name} ({p.quantity} un)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border rounded-xl"
          placeholder="Buscar produtos..."
        />
      </div>

      {/* Lista de Produtos — rolagem horizontal + colunas finais fixas (Estoque/Ações sempre visíveis) */}
      <p className="text-xs text-gray-500 -mt-2">
        Não está vendo estoque ou os botões? Role a tabela para a direita — ou use a barra de rolagem abaixo da lista.
      </p>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Código
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Foto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Produto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Categoria
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preço
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Custo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-[168px] z-20 bg-gray-50 shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.08)]">
                Estoque
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 z-20 bg-gray-50 shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.08)]">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProducts.map(product => {
              const imgSrc = getProductImageSrc(product);
              return (
              <tr key={product.id} className="group hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-500 font-mono">{product.barcode || '-'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!imgSrc) return;
                      setImageProduct(product);
                      setShowImageModal(true);
                    }}
                    className={`w-12 h-12 rounded-lg border overflow-hidden bg-gray-50 flex items-center justify-center ${
                      imgSrc ? 'hover:ring-2 hover:ring-purple-400 cursor-zoom-in' : 'cursor-default'
                    }`}
                    title={imgSrc ? 'Ver imagem' : 'Sem imagem'}
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={18} className="text-gray-300" />
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (!imgSrc) return;
                      setImageProduct(product);
                      setShowImageModal(true);
                    }}
                    className={`font-medium text-gray-900 text-left ${
                      imgSrc ? 'hover:text-purple-700' : ''
                    }`}
                    title={imgSrc ? 'Clique para ver a imagem' : 'Sem imagem'}
                  >
                    {product.name}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                    {product.category || 'Sem categoria'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">
                  R$ {product.price.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  R$ {product.cost.toFixed(2)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap sticky right-[168px] z-10 bg-white group-hover:bg-gray-50 shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.06)]">
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                    product.quantity <= product.minStock
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {product.quantity} un
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-right space-x-2 sticky right-0 z-10 bg-white group-hover:bg-gray-50 shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.06)]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProduct(product);
                      setShowStockModal(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Ajustar estoque"
                  >
                    <Package className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProduct(product);
                      setShowHistoryModal(true);
                    }}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                    title="Histórico"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(product);
                    }}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(product.id);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      {/* Modal Produto */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código de Barras
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Escaneie ou digite o código"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Produto
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  list="categories"
                  placeholder="Ex: Bebidas, Snacks, Acessórios"
                />
                <datalist id="categories">
                  {categories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço de Venda
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custo
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Upload de Imagem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagem do Produto (opcional)
                </label>
                <div className="flex items-center gap-4">
                  {formData.image ? (
                    <img 
                      src={formData.image} 
                      alt="Preview" 
                      className="w-16 h-16 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Camera size={24} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const dataUrl = await fileToCompressedDataUrl(file);
                            setFormData(prev => ({ ...prev, image: dataUrl }));
                          } catch {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData(prev => ({ ...prev, image: reader.result as string }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                      id="product-image-input"
                    />
                    <label
                      htmlFor="product-image-input"
                      className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      <Camera size={16} />
                      Selecionar Imagem
                    </label>
                    {formData.image && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                        className="ml-2 text-red-500 hover:text-red-600 text-sm"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {editingProduct ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajustar Estoque */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Ajustar Estoque</h3>
            <p className="text-gray-500 mb-4">{selectedProduct.name}</p>
            <p className="text-sm text-gray-600 mb-4">
              Estoque atual: <strong>{selectedProduct.quantity}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Movimentação
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStockType('entry')}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      stockType === 'entry'
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockType('adjustment')}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      stockType === 'adjustment'
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-gray-200'
                    }`}
                  >
                    <ArrowDown className="w-4 h-4" />
                    Saída
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade
                </label>
                <input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Quantidade"
                />
              </div>

              {stockQuantity && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Novo estoque:</p>
                  <p className="text-xl font-bold">
                    {stockType === 'entry'
                      ? selectedProduct.quantity + Number(stockQuantity)
                      : selectedProduct.quantity - Number(stockQuantity)} unidades
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowStockModal(false);
                  setSelectedProduct(null);
                  setStockQuantity('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleStockAdjust}
                disabled={!stockQuantity}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico */}
      {showHistoryModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Histórico de Movimentações</h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedProduct(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 mb-4">{selectedProduct.name}</p>

            <div className="flex-1 overflow-auto">
              {productMovements.length > 0 ? (
                <div className="space-y-3">
                  {productMovements.map(movement => (
                    <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">
                          {movement.type === 'entry' ? 'Entrada' : movement.type === 'sale' ? 'Venda' : 'Ajuste'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(movement.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${movement.type === 'entry' ? 'text-green-600' : 'text-red-600'}`}>
                          {movement.type === 'entry' ? '+' : '-'}{movement.quantity}
                        </p>
                        <p className="text-sm text-gray-500">
                          {movement.previousStock} → {movement.newStock}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Nenhuma movimentação registrada
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Imagem */}
      {showImageModal && imageProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate">{imageProduct.name}</h3>
                <p className="text-sm text-gray-500 truncate">{imageProduct.category || 'Sem categoria'}</p>
              </div>
              <button
                onClick={() => {
                  setShowImageModal(false);
                  setImageProduct(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center">
              {getProductImageSrc(imageProduct) ? (
                <img
                  src={getProductImageSrc(imageProduct)}
                  alt={imageProduct.name}
                  className="max-h-[75vh] w-auto object-contain"
                />
              ) : (
                <div className="text-white/70 p-10">Sem imagem</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
