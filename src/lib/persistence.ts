import { useStore } from "../store/useStore";
import { useSettingsStore } from "../store/settingsStore";

const SAVE_DEBOUNCE_MS = 500; // Reduzido de 1200 para 500ms

function buildAppStateSnapshot() {
  const state = useStore.getState() as unknown as Record<string, unknown>;
  return {
    users: state.users,
    devices: state.devices,
    sessions: state.sessions,
    products: state.products,
    stockMovements: state.stockMovements,
    sales: state.sales,
    cart: state.cart,
    customers: state.customers,
    budgets: state.budgets,
    serviceOrders: state.serviceOrders,
    nextExternalIds: state.nextExternalIds,
    cashRegister: state.cashRegister,
    cashHistory: state.cashHistory,
    currentPage: state.currentPage,
    currentUser: state.currentUser
  };
}

function buildSettingsSnapshot() {
  const state = useSettingsStore.getState() as unknown as { settings?: Record<string, unknown> };
  return {
    settings: state.settings ?? {}
  };
}

export async function initExternalPersistence() {
  if (!window.lhgSystem) return;

  const diskState = await window.lhgSystem.loadState();
  if (diskState?.appState) {
    useStore.setState(diskState.appState as Partial<ReturnType<typeof useStore.getState>>);
  }
  if (diskState?.settingsState) {
    useSettingsStore.setState(diskState.settingsState as Partial<ReturnType<typeof useSettingsStore.getState>>);
  }

  // Cria backup do estado em disco já existente antes de novas gravações.
  if (diskState) {
    await window.lhgSystem.createBackup();
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void window.lhgSystem?.saveState({
        appState: buildAppStateSnapshot(),
        settingsState: buildSettingsSnapshot()
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const saveNow = () => {
    if (timer) clearTimeout(timer);
    void window.lhgSystem?.saveState({
      appState: buildAppStateSnapshot(),
      settingsState: buildSettingsSnapshot()
    });
  };

  // Migra estado atual (localStorage) para arquivo externo na primeira inicialização.
  if (!diskState) {
    await window.lhgSystem.saveState({
      appState: buildAppStateSnapshot(),
      settingsState: buildSettingsSnapshot()
    });
  }

  let lastUser = useStore.getState().currentUser;

  useStore.subscribe((state) => {
    const isLogout = lastUser !== null && state.currentUser === null;
    lastUser = state.currentUser;

    if (isLogout) {
      saveNow();
    } else {
      scheduleSave();
    }
  });

  useSettingsStore.subscribe(scheduleSave);
}
