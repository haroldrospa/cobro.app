
export const isElectron = (): boolean => {
    return typeof window !== 'undefined' &&
        (window as any).ipcRenderer !== undefined;
};

export interface SystemPrinter {
    name: string;
    displayName: string;
    description: string;
    status: number;
    isDefault: boolean;
    options: any;
}

export const getSystemPrinters = async (): Promise<SystemPrinter[]> => {
    if (!isElectron()) return [];
    try {
        return await (window as any).ipcRenderer.invoke('get-printers');
    } catch (error) {
        console.error('Error getting system printers:', error);
        return [];
    }
};

export const printToSystemPrinter = async (
    printerName: string,
    htmlContent: string,
    width: string = '80mm'
): Promise<{ success: boolean; error?: string }> => {
    if (!isElectron()) {
        return { success: false, error: 'Not running in Electron environment' };
    }

    try {
        return await (window as any).ipcRenderer.invoke('print-data', {
            printerName,
            htmlContent,
            width
        });
    } catch (error: any) {
        return { success: false, error: error.message || 'Unknown printing error' };
    }
};
