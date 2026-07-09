package com.cobro.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cobro.app.printer.BluetoothPrinterManager
import com.cobro.app.printer.PrinterStatus
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * PosSettingsActivity — Pantalla nativa de configuración POS en Jetpack Compose.
 *
 * Diseño Material Design 3 con la identidad visual de CobroApp (índigo/violeta).
 * Permite:
 * - Ver y seleccionar impresoras Bluetooth emparejadas
 * - Probar la impresión
 * - Configurar tamaño de papel (58mm / 80mm)
 * - Activar/desactivar impresión automática, sonido y vibración
 * - Ver el estado de Bluetooth en tiempo real
 */
class PosSettingsActivity : ComponentActivity() {

    private lateinit var printerManager: BluetoothPrinterManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        printerManager = BluetoothPrinterManager.getInstance(this)

        setContent {
            CobroPosTheme {
                PosSettingsScreen(
                    printerManager = printerManager,
                    onBack = { finish() }
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  TEMA
// ═══════════════════════════════════════════════════════════

private val CobroDark = darkColorScheme(
    primary         = Color(0xFF818CF8),
    onPrimary       = Color(0xFF1E1B4B),
    primaryContainer = Color(0xFF312E81),
    onPrimaryContainer = Color(0xFFC7D2FE),
    secondary       = Color(0xFF34D399),
    onSecondary     = Color(0xFF052E16),
    surface         = Color(0xFF1A1A2E),
    onSurface       = Color(0xFFE2E8F0),
    surfaceVariant  = Color(0xFF252540),
    onSurfaceVariant = Color(0xFF94A3B8),
    background      = Color(0xFF0F0F1A),
    onBackground    = Color(0xFFE2E8F0),
    error           = Color(0xFFFC8181),
    outline         = Color(0xFF374151)
)

@Composable
private fun CobroPosTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = CobroDark,
        content = content
    )
}

// ═══════════════════════════════════════════════════════════
//  PANTALLA PRINCIPAL
// ═══════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PosSettingsScreen(
    printerManager: BluetoothPrinterManager,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()

    // Estado de la impresora
    var printerStatus by remember { mutableStateOf(printerManager.status) }
    var pairedPrinters by remember { mutableStateOf<List<PrinterDevice>>(emptyList()) }
    var selectedAddress by remember { mutableStateOf(printerManager.getDefaultPrinterAddress() ?: "") }

    // Configuración
    var paperWidth by remember { mutableStateOf(printerManager.getPaperWidthMm()) }
    var autoPrint by remember { mutableStateOf(printerManager.isAutoPrintEnabled()) }
    var soundEnabled by remember { mutableStateOf(printerManager.isSoundEnabled()) }
    var vibrationEnabled by remember { mutableStateOf(printerManager.isVibrationEnabled()) }

    // UI state
    var isPrinting by remember { mutableStateOf(false) }
    var snackbarMessage by remember { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    // Cargar impresoras emparejadas
    LaunchedEffect(Unit) {
        pairedPrinters = parsePrinters(printerManager.getPairedPrinters())
    }

    // Polling de estado de la impresora
    LaunchedEffect(Unit) {
        while (true) {
            printerStatus = printerManager.status
            delay(1500)
        }
    }

    // Mostrar snackbar
    LaunchedEffect(snackbarMessage) {
        snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            snackbarMessage = null
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Configuración POS",
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Regresar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            // ── Estado de Bluetooth ─────────────────────────────────
            item {
                BluetoothStatusCard(
                    isEnabled = printerManager.isBluetoothEnabled(),
                    printerStatus = printerStatus,
                    connectedPrinterName = pairedPrinters
                        .find { it.address == selectedAddress }?.name ?: ""
                )
            }

            // ── Impresoras disponibles ──────────────────────────────
            item {
                SectionHeader("Impresoras Bluetooth", Icons.Default.Print)
            }

            if (pairedPrinters.isEmpty()) {
                item {
                    EmptyPrintersCard()
                }
            } else {
                items(pairedPrinters) { printer ->
                    PrinterCard(
                        printer = printer,
                        isSelected = printer.address == selectedAddress,
                        isConnected = printer.address == selectedAddress && printerStatus == PrinterStatus.CONNECTED,
                        onClick = {
                            selectedAddress = printer.address
                            printerManager.setDefaultPrinter(printer.address)
                            scope.launch {
                                printerManager.connectByAddress(printer.address) { success, error ->
                                    snackbarMessage = if (success)
                                        "✅ Conectado a ${printer.name}"
                                    else
                                        "❌ Error: $error"
                                }
                            }
                        }
                    )
                }
            }

            // ── Botón de prueba ─────────────────────────────────────
            item {
                Button(
                    onClick = {
                        if (printerStatus != PrinterStatus.CONNECTED) {
                            snackbarMessage = "Primero selecciona y conecta una impresora"
                            return@Button
                        }
                        isPrinting = true
                        scope.launch {
                            printerManager.printTestPage { success, error ->
                                isPrinting = false
                                snackbarMessage = if (success) "✅ Página de prueba enviada" else "❌ $error"
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    ),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !isPrinting
                ) {
                    if (isPrinting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp
                        )
                        Spacer(Modifier.width(8.dp))
                    } else {
                        Icon(Icons.Default.Print, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                    }
                    Text("Probar Impresión", fontWeight = FontWeight.SemiBold)
                }
            }

            // ── Tamaño de papel ─────────────────────────────────────
            item {
                SectionHeader("Tamaño de Papel", Icons.Default.Article)
            }

            item {
                PaperSizeSelector(
                    selected = paperWidth,
                    onSelect = {
                        paperWidth = it
                        printerManager.setPaperWidthMm(it)
                    }
                )
            }

            // ── Configuración general ───────────────────────────────
            item {
                SectionHeader("Preferencias", Icons.Default.Settings)
            }

            item {
                SettingsCard {
                    SettingsToggle(
                        icon = Icons.Default.AutoAwesome,
                        title = "Impresión automática",
                        subtitle = "Imprimir al completar cada venta",
                        checked = autoPrint,
                        onCheckedChange = {
                            autoPrint = it
                            printerManager.setAutoPrint(it)
                        }
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    SettingsToggle(
                        icon = Icons.Default.VolumeUp,
                        title = "Sonido",
                        subtitle = "Reproducir sonido al imprimir",
                        checked = soundEnabled,
                        onCheckedChange = {
                            soundEnabled = it
                            printerManager.setSoundEnabled(it)
                        }
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
                    SettingsToggle(
                        icon = Icons.Default.Vibration,
                        title = "Vibración",
                        subtitle = "Vibrar al completar la impresión",
                        checked = vibrationEnabled,
                        onCheckedChange = {
                            vibrationEnabled = it
                            printerManager.setVibrationEnabled(it)
                        }
                    )
                }
            }

            item { Spacer(Modifier.height(32.dp)) }
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTES UI
// ═══════════════════════════════════════════════════════════

@Composable
private fun BluetoothStatusCard(
    isEnabled: Boolean,
    printerStatus: PrinterStatus,
    connectedPrinterName: String
) {
    val gradientColors = if (isEnabled) {
        listOf(Color(0xFF312E81), Color(0xFF1E3A5F))
    } else {
        listOf(Color(0xFF1F2937), Color(0xFF111827))
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.horizontalGradient(gradientColors))
                .padding(20.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Bluetooth,
                    contentDescription = null,
                    tint = if (isEnabled) Color(0xFF818CF8) else Color(0xFF6B7280),
                    modifier = Modifier.size(40.dp)
                )
                Spacer(Modifier.width(16.dp))
                Column {
                    Text(
                        text = "Bluetooth",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFFE2E8F0),
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = if (isEnabled) "Activo" else "Desactivado",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (isEnabled) Color(0xFF34D399) else Color(0xFF9CA3AF)
                    )
                }
                Spacer(Modifier.weight(1f))
                PrinterStatusChip(printerStatus)
            }
        }
    }
}

@Composable
private fun PrinterStatusChip(status: PrinterStatus) {
    val (label, color) = when (status) {
        PrinterStatus.CONNECTED    -> "Conectada"   to Color(0xFF34D399)
        PrinterStatus.CONNECTING   -> "Conectando"  to Color(0xFFFBBF24)
        PrinterStatus.PRINTING     -> "Imprimiendo" to Color(0xFF818CF8)
        PrinterStatus.ERROR        -> "Error"        to Color(0xFFFC8181)
        PrinterStatus.DISCONNECTED -> "Sin conexión" to Color(0xFF6B7280)
    }

    val animatedColor by animateColorAsState(
        targetValue = color,
        animationSpec = tween(400),
        label = "chip_color"
    )

    Surface(
        shape = RoundedCornerShape(20.dp),
        color = animatedColor.copy(alpha = 0.2f),
        modifier = Modifier.border(1.dp, animatedColor.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(animatedColor)
            )
            Spacer(Modifier.width(6.dp))
            Text(label, color = animatedColor, fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun SectionHeader(title: String, icon: ImageVector) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
private fun PrinterCard(
    printer: PrinterDevice,
    isSelected: Boolean,
    isConnected: Boolean,
    onClick: () -> Unit
) {
    val borderColor by animateColorAsState(
        targetValue = if (isSelected) Color(0xFF818CF8) else Color(0xFF374151),
        animationSpec = tween(300),
        label = "border"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .border(
                width = if (isSelected) 1.5.dp else 1.dp,
                color = borderColor,
                shape = RoundedCornerShape(12.dp)
            ),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            else
                MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Print,
                contentDescription = null,
                tint = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(28.dp)
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = printer.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = printer.address,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (isSelected) {
                if (isConnected) {
                    PrinterStatusChip(PrinterStatus.CONNECTED)
                } else {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF818CF8))
                }
            }
        }
    }
}

@Composable
private fun EmptyPrintersCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                Icons.Default.BluetoothSearching,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(48.dp)
            )
            Spacer(Modifier.height(12.dp))
            Text(
                "No hay impresoras emparejadas",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Ve a Ajustes > Bluetooth y empareja tu impresora ESC/POS",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

@Composable
private fun PaperSizeSelector(selected: Int, onSelect: (Int) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        listOf(58 to "58 mm", 80 to "80 mm").forEach { (size, label) ->
            val isSelected = selected == size
            Card(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onSelect(size) }
                    .border(
                        width = if (isSelected) 2.dp else 1.dp,
                        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                        shape = RoundedCornerShape(12.dp)
                    ),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isSelected)
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                    else
                        MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Receipt,
                        contentDescription = null,
                        tint = if (isSelected) MaterialTheme.colorScheme.primary
                               else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        label,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(content = content)
    }
}

@Composable
private fun SettingsToggle(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(22.dp)
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurface)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
                checkedTrackColor = MaterialTheme.colorScheme.primary
            )
        )
    }
}

// ═══════════════════════════════════════════════════════════
//  MODELOS DE DATOS
// ═══════════════════════════════════════════════════════════

data class PrinterDevice(
    val name: String,
    val address: String,
    val isDefault: Boolean = false
)

@SuppressLint("MissingPermission")
private fun parsePrinters(json: String): List<PrinterDevice> {
    return try {
        val array = JSONArray(json)
        (0 until array.length()).map { i ->
            val obj = array.getJSONObject(i)
            PrinterDevice(
                name = obj.optString("name", "Impresora desconocida"),
                address = obj.optString("address", ""),
                isDefault = obj.optBoolean("isDefault", false)
            )
        }
    } catch (_: Exception) { emptyList() }
}
