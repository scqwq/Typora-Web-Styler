function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('web-markdown-themes', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('bundles', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`主题资源数据库打开失败：${request.error?.message}`));
    request.onblocked = () => reject(new Error('主题数据库升级被其他设置页阻塞，请关闭其他设置页后重试。'));
  });
}
async function transact(mode, operation) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('bundles', mode);
      const request = operation(transaction.objectStore('bundles'));
      let result;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = transaction.onabort = () => reject(new Error(`主题资源保存/读取失败：${transaction.error?.message || '事务中止'}`));
    });
  } finally { db.close(); }
}
export const putBundle = bundle => transact('readwrite', store => store.put(bundle));
export const getBundle = id => transact('readonly', store => store.get(id));
export const deleteBundle = id => transact('readwrite', store => store.delete(id));
