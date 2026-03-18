import type { Uplink } from "./types"

export interface DecodedHexEvent {
  codeHex: string
  severity: "ERROR" | "WARN" | "INFO"
  name: string
  description: string
}

export interface DecodedBitmaskFlag {
  bit: number
  maskHex: string
  name: string
  category: string
  description: string
}

export interface UploadFailureLog {
  id: string
  devEui: string
  previousAt: string
  at: string
  expectedIntervalSec: number
  actualIntervalSec: number
  exceededBySec: number
  errorEventHex: string | null
  warningEventHex: string | null
  infoEventHex: string | null
  decodedErrorEvent: DecodedHexEvent | null
  decodedWarningEvent: DecodedHexEvent | null
  decodedInfoEvent: DecodedHexEvent | null
  decodedErrorFlags: DecodedBitmaskFlag[]
  previousMeterValue: number | null
  previousMeterValueRaw: string | null
  currentMeterValue: number | null
  currentMeterValueRaw: string | null
  previousBatteryMv: number | null
  currentBatteryMv: number | null
  failureReason: string
  payload: Record<string, unknown> | null
}

interface EventCodeDef {
  name: string
  description: string
}

interface BitmaskDef {
  bit: number
  maskHex: string
  name: string
  category: string
  description: string
}




const ERROR_EVENT_CODES: Record<string, EventCodeDef> = {
  "0001": { name: "IC_EVENT_ERR_SYS_PSRAM_INIT_FAIL", description: "PSRAM/TENSOR init for system failed at startup" },
  "0002": { name: "IC_EVENT_ERR_SYS_TENSOR_ARENA_INIT_FAIL", description: "Tensor arena initialization failed in main" },
  "0003": { name: "IC_EVENT_ERR_SYS_OTA_ROLLBACK", description: "Booted due to OTA rollback condition" },
  "0004": { name: "IC_EVENT_ERR_SYS_WIFI_NO_IP_SLEEP", description: "Went to sleep because Wi-Fi never got IP" },
  "0005": { name: "IC_EVENT_ERR_SYS_NO_NETWORK_SLEEP", description: "Went to sleep because there was no network connectivity" },
  "0008": { name: "IC_EVENT_ERR_NVS_READ_FAIL", description: "Generic NVS read error" },
  "0009": { name: "IC_EVENT_ERR_NVS_WRITE_FAIL", description: "Generic NVS write error" },
  "000A": { name: "IC_EVENT_ERR_NVS_DEBUG_READ_FAIL", description: "Failed to read debug flag from NVS" },
  "000B": { name: "IC_EVENT_ERR_NVS_DEBUG_WRITE_FAIL", description: "Failed to write debug flag to NVS" },
  "000C": { name: "IC_EVENT_ERR_CONFIG_INVALID_CROP", description: "Received invalid crop configuration from host/downlink" },
  "000D": { name: "IC_EVENT_ERR_CONFIG_INVALID_THRESHOLD", description: "Received invalid threshold configuration from host/downlink" },
  "0010": { name: "IC_EVENT_ERR_CAM_MUTEX_CREATE_FAIL", description: "Failed to create camera mutex or lock primitive" },
  "0011": { name: "IC_EVENT_ERR_CAM_SHARED_REGION_IN_USE", description: "Camera shared memory region in use when not expected" },
  "0012": { name: "IC_EVENT_ERR_CAM_PSRAM_ALLOC_FAIL", description: "Camera PSRAM allocation failed" },
  "0013": { name: "IC_EVENT_ERR_CAM_INIT_FAIL", description: "Camera initialization failed" },
  "0014": { name: "IC_EVENT_ERR_CAM_CAPTURE_FAIL", description: "Camera frame capture failed" },
  "0015": { name: "IC_EVENT_ERR_CAM_FORMAT_NOT_GRAYSCALE", description: "Camera frame format not grayscale when required" },
  "0016": { name: "IC_EVENT_ERR_CAM_HDR_INVALID_ARGS", description: "HDR pipeline called with invalid arguments" },
  "0017": { name: "IC_EVENT_ERR_CAM_HDR_NOT_GRAYSCALE", description: "HDR frame not grayscale" },
  "0018": { name: "IC_EVENT_ERR_CAM_HDR_CAPTURE_FAIL", description: "Failed to capture one of the HDR frames" },
  "0019": { name: "IC_EVENT_ERR_CAM_HDR_SIZE_MISMATCH", description: "HDR frame dimensions mismatch base frame" },
  "001C": { name: "IC_EVENT_ERR_OBJ_STACK_ALLOC_FAIL", description: "Object-detect stack allocation failed" },
  "001D": { name: "IC_EVENT_ERR_OBJ_STACK_REALLOC_FAIL", description: "Object-detect stack reallocation failed" },
  "001E": { name: "IC_EVENT_ERR_OBJ_STACK_UNDERFLOW", description: "Attempt to pop from empty object-detect stack" },
  "001F": { name: "IC_EVENT_ERR_OBJ_INVALID_BBOX_DIM", description: "Invalid bounding box dimensions in object-detect" },
  "0020": { name: "IC_EVENT_ERR_OBJ_ROI_ALLOC_FAIL", description: "ROI allocation failed" },
  "0021": { name: "IC_EVENT_ERR_OBJ_RESIZED_ROI_ALLOC_FAIL", description: "Resized ROI allocation failed" },
  "0022": { name: "IC_EVENT_ERR_OBJ_TEMPBUF_ALLOC_FAIL", description: "Temporary buffer allocation failed" },
  "0023": { name: "IC_EVENT_ERR_OBJ_DISPLAY_ALLOC_FAIL", description: "Display buffer allocation failed" },
  "0028": { name: "IC_EVENT_ERR_OCR_MODEL_LOAD_FAIL", description: "Failed to load OCR TFLite model" },
  "0029": { name: "IC_EVENT_ERR_OCR_TENSOR_ALLOC_FAIL", description: "Failed to allocate OCR tensors" },
  "002A": { name: "IC_EVENT_ERR_OCR_INPUT_TYPE_MISMATCH", description: "OCR input tensor type mismatch" },
  "002B": { name: "IC_EVENT_ERR_OCR_NOT_INITIALIZED", description: "OCR model invoked before initialization" },
  "002C": { name: "IC_EVENT_ERR_OCR_INPUT_SIZE_MISMATCH", description: "OCR input tensor size mismatch" },
  "002D": { name: "IC_EVENT_ERR_OCR_INVOKE_FAIL", description: "OCR interpreter Invoke() failed" },
  "0030": { name: "IC_EVENT_ERR_VAL_RESULT_ARRAY_FULL", description: "Results array full before processing complete" },
  "0031": { name: "IC_EVENT_ERR_VAL_OUT_OF_RANGE", description: "Reading failed validation range check" },
  "0032": { name: "IC_EVENT_ERR_VAL_READING_DECREASED", description: "Reading decreased unexpectedly vs previous value" },
  "0033": { name: "IC_EVENT_ERR_VAL_MOST_FREQ_ALLOC_FAIL", description: "Allocation failed in most-frequent-digit logic" },
  "0038": { name: "IC_EVENT_ERR_LORA_UART_INIT_FAIL", description: "UART init for LoRa-E5 failed" },
  "0039": { name: "IC_EVENT_ERR_LORA_JOIN_FAIL", description: "LoRa OTAA join failed after retries" },
  "003A": { name: "IC_EVENT_ERR_LORA_SEND_FAIL", description: "LoRa send operation failed" },
  "003B": { name: "IC_EVENT_ERR_LORA_NOT_JOINED", description: "LoRa send attempted while not joined" },
  "003C": { name: "IC_EVENT_ERR_LORA_NO_RESPONSE", description: "No response from LoRa module after uplink" },
  "003D": { name: "IC_EVENT_ERR_LORA_ACK_TIMEOUT", description: "ACK not received or timed out for confirmed uplink" },
  "003E": { name: "IC_EVENT_ERR_HTTP_WEBHOOK_POST_FAIL", description: "Webhook POST to backend failed" },
}

const WARN_EVENT_CODES: Record<string, EventCodeDef> = {
  "0040": { name: "IC_EVENT_WARN_SYS_WIFI_RECONNECTING", description: "Wi-Fi reconnect was triggered" },
  "0041": { name: "IC_EVENT_WARN_SYS_PAIRING_TIMEOUT", description: "SoftAP/pairing process timed out" },
  "0042": { name: "IC_EVENT_WARN_SYS_OTA_ROLLBACK_OCCURRED", description: "OTA rollback was detected during this boot" },
  "0045": { name: "IC_EVENT_WARN_NVS_DEBUG_STATUS_MISSING", description: "Debug status key missing in NVS; using default" },
  "0046": { name: "IC_EVENT_WARN_CONFIG_FALLBACK_DEFAULTS", description: "Config invalid; fell back to defaults" },
  "0048": { name: "IC_EVENT_WARN_CAM_HDR_SKIPPED", description: "HDR processing skipped (conditions not met)" },
  "0049": { name: "IC_EVENT_WARN_CAM_USING_RANDOM_SETTINGS", description: "Randomized camera settings used for capture" },
  "004A": { name: "IC_EVENT_WARN_CAM_CALIBRATION_INCOMPLETE", description: "Camera calibration not fully completed" },
  "004C": { name: "IC_EVENT_WARN_OBJ_INFERENCE_TOO_SLOW", description: "Object-detect/OCR inference took too long" },
  "004D": { name: "IC_EVENT_WARN_OBJ_INFERENCE_TIMEOUT", description: "Inference timed out and pipeline was reset" },
  "0050": { name: "IC_EVENT_WARN_VAL_DEVICE_FAILURE_COUNT_INC", description: "Device failure count incremented this cycle" },
  "0051": { name: "IC_EVENT_WARN_VAL_MONOTONIC_CHECK_SKIPPED", description: "Monotonicity check had to be skipped" },
  "0052": { name: "IC_EVENT_WARN_VAL_ZERO_CROSSING_ADJUSTED", description: "Zero-crossing adjustment applied to fraction" },
  "0058": { name: "IC_EVENT_WARN_LORA_JOIN_RETRYING", description: "LoRa join is being retried" },
  "0059": { name: "IC_EVENT_WARN_LORA_ADR_DISABLED", description: "LoRa ADR disabled or not in use" },
  "005A": { name: "IC_EVENT_WARN_LORA_UPLINK_RATE_HIGH", description: "Uplink rate is higher than expected (test mode?)" },
  "005C": { name: "IC_EVENT_WARN_HTTP_WEBHOOK_RETRY", description: "Retrying webhook POST" },
}

const INFO_EVENT_CODES: Record<string, EventCodeDef> = {
  "0080": { name: "IC_EVENT_INFO_SYS_BOOT_COLD", description: "Cold boot event recorded" },
  "0081": { name: "IC_EVENT_INFO_SYS_BOOT_DEEP_SLEEP_WAKE", description: "Wake from deep sleep" },
  "0082": { name: "IC_EVENT_INFO_SYS_POWER_USB", description: "Running on USB power" },
  "0083": { name: "IC_EVENT_INFO_SYS_POWER_BATTERY", description: "Running on battery power" },
  "0084": { name: "IC_EVENT_INFO_SYS_WIFI_STA_GOT_IP", description: "Wi-Fi STA got IP" },
  "0085": { name: "IC_EVENT_INFO_SYS_WIFI_PROVISIONED", description: "Wi-Fi credentials provisioned successfully" },
  "0086": { name: "IC_EVENT_INFO_SYS_PAIRING_STARTED", description: "Pairing/SoftAP process started" },
  "0087": { name: "IC_EVENT_INFO_SYS_PAIRING_FINISHED", description: "Pairing/SoftAP process finished" },
  "0088": { name: "IC_EVENT_INFO_SYS_PRODUCTION_MODE_RUN", description: "Production-mode test run executed" },
  "0089": { name: "IC_EVENT_INFO_SYS_PRODUCTION_MODE_DONE", description: "Production-mode tests completed" },
  "008C": { name: "IC_EVENT_INFO_DEBUG_ENABLED", description: "Debug mode enabled" },
  "008D": { name: "IC_EVENT_INFO_DEBUG_DISABLED", description: "Debug mode disabled" },
  "008E": { name: "IC_EVENT_INFO_CONFIG_CROP_UPDATED", description: "Crop configuration updated this cycle" },
  "008F": { name: "IC_EVENT_INFO_CONFIG_THRESHOLD_UPDATED", description: "Threshold configuration updated this cycle" },
  "0090": { name: "IC_EVENT_INFO_CAM_SETUP_DONE", description: "Camera setup completed successfully" },
  "0091": { name: "IC_EVENT_INFO_CAM_CROP_SET", description: "Camera crop region configured" },
  "0092": { name: "IC_EVENT_INFO_CAM_RANDOM_SETTINGS_USED", description: "Random camera parameters selected" },
  "0093": { name: "IC_EVENT_INFO_CAM_SAVED_SETTINGS_USED", description: "Saved camera parameters restored" },
  "0094": { name: "IC_EVENT_INFO_CAM_EROSION_SET", description: "Erosion parameter configured" },
  "0098": { name: "IC_EVENT_INFO_OCR_MODEL_INITIALIZED", description: "OCR model initialized" },
  "0099": { name: "IC_EVENT_INFO_OCR_MODEL_CLEANED_UP", description: "OCR model resources cleaned up" },
  "009A": { name: "IC_EVENT_INFO_OCR_PATCH_SUCCESS", description: "OCR patch/correction succeeded" },
  "009C": { name: "IC_EVENT_INFO_VAL_READING_ACCEPTED", description: "Reading accepted after validation" },
  "009D": { name: "IC_EVENT_INFO_VAL_POSTPATCH_PASSED", description: "Post-patch validation passed" },
  "00A0": { name: "IC_EVENT_INFO_LORA_JOINED", description: "LoRa network joined successfully" },
  "00A1": { name: "IC_EVENT_INFO_LORA_UPLINK_SENT", description: "LoRa uplink sent successfully" },
  "00A2": { name: "IC_EVENT_INFO_LORA_DOWNLINK_APPLIED", description: "Configuration from LoRa downlink applied" },
  "00A3": { name: "IC_EVENT_INFO_HTTP_WEBHOOK_POST_OK", description: "Webhook POST succeeded" },
}

const ERROR_BITMASK_CODES: BitmaskDef[] = [
  { bit: 0, maskHex: "0x0000000000000001", name: "IC_ERR_SYS_BOOT_COLD", category: "System", description: "Cold power-on boot (not from deep sleep)" },
  { bit: 1, maskHex: "0x0000000000000002", name: "IC_ERR_SYS_BOOT_DEEP_SLEEP_WAKE", category: "System", description: "Booted from deep sleep wakeup" },
  { bit: 2, maskHex: "0x0000000000000004", name: "IC_ERR_SYS_POWER_USB", category: "System", description: "Detected USB power mode" },
  { bit: 3, maskHex: "0x0000000000000008", name: "IC_ERR_SYS_POWER_BATTERY", category: "System", description: "Detected battery power mode" },
  { bit: 4, maskHex: "0x0000000000000010", name: "IC_ERR_SYS_WIFI_STA_GOT_IP", category: "System", description: "Wi-Fi station obtained IP at least once this cycle" },
  { bit: 5, maskHex: "0x0000000000000020", name: "IC_ERR_SYS_WIFI_RECONNECTING", category: "System", description: "Wi-Fi reconnect sequence was triggered" },
  { bit: 6, maskHex: "0x0000000000000040", name: "IC_ERR_SYS_NO_NETWORK_SLEEP", category: "System", description: "Went to sleep due to prolonged lack of network" },
  { bit: 7, maskHex: "0x0000000000000080", name: "IC_ERR_SYS_NO_IP_FOR_UPLOAD", category: "System", description: "Could not upload because no IP was available" },
  { bit: 8, maskHex: "0x0000000000000100", name: "IC_ERR_NVS_READ_FAIL", category: "NVS/Config", description: "Generic NVS read failed" },
  { bit: 9, maskHex: "0x0000000000000200", name: "IC_ERR_NVS_WRITE_FAIL", category: "NVS/Config", description: "Generic NVS write failed" },
  { bit: 10, maskHex: "0x0000000000000400", name: "IC_ERR_NVS_DEBUG_FLAG_READ_FAIL", category: "NVS/Config", description: "Failed to read debug flag from NVS" },
  { bit: 11, maskHex: "0x0000000000000800", name: "IC_ERR_NVS_DEBUG_FLAG_WRITE_FAIL", category: "NVS/Config", description: "Failed to write debug flag to NVS" },
  { bit: 12, maskHex: "0x0000000000001000", name: "IC_ERR_CONFIG_INVALID_CROP", category: "NVS/Config", description: "Received invalid crop configuration" },
  { bit: 13, maskHex: "0x0000000000002000", name: "IC_ERR_CONFIG_INVALID_THRESHOLD", category: "NVS/Config", description: "Received invalid threshold configuration" },
  { bit: 14, maskHex: "0x0000000000004000", name: "IC_ERR_CONFIG_DEBUG_ENABLED", category: "NVS/Config", description: "Debug mode enabled for this cycle" },
  { bit: 15, maskHex: "0x0000000000008000", name: "IC_ERR_CONFIG_DEBUG_DISABLED", category: "NVS/Config", description: "Debug mode explicitly disabled for this cycle" },
  { bit: 16, maskHex: "0x0000000000010000", name: "IC_ERR_PSRAM_RESERVE_FAIL", category: "Memory", description: "PSRAM reservation/init for camera or tensors failed" },
  { bit: 17, maskHex: "0x0000000000020000", name: "IC_ERR_PSRAM_ALLOC_FAIL", category: "Memory", description: "Generic PSRAM allocation failed" },
  { bit: 18, maskHex: "0x0000000000040000", name: "IC_ERR_MEM_STACK_ALLOC_FAIL", category: "Memory", description: "Stack allocation failed in object-detect pipeline" },
  { bit: 19, maskHex: "0x0000000000080000", name: "IC_ERR_MEM_STACK_REALLOC_FAIL", category: "Memory", description: "Stack reallocation failed in object-detect pipeline" },
  { bit: 20, maskHex: "0x0000000000100000", name: "IC_ERR_MEM_STACK_UNDERFLOW", category: "Memory", description: "Attempted to pop from an empty stack" },
  { bit: 21, maskHex: "0x0000000000200000", name: "IC_ERR_MEM_TENSOR_INIT_FAIL", category: "Memory", description: "Tensor arena initialization failed" },
  { bit: 22, maskHex: "0x0000000000400000", name: "IC_ERR_MEM_PROCESSED_IMAGE_ALLOC_FAIL", category: "Memory", description: "Allocation of processed_image buffer failed" },
  { bit: 23, maskHex: "0x0000000000800000", name: "IC_ERR_MEM_RESIZED_IMAGE_PTR_NULL", category: "Memory", description: "Resized image pointer unexpectedly NULL" },
  { bit: 24, maskHex: "0x0000000001000000", name: "IC_ERR_CAM_INIT_FAILED", category: "Camera", description: "Camera initialization failed" },
  { bit: 25, maskHex: "0x0000000002000000", name: "IC_ERR_CAM_DEINIT_FAILED", category: "Camera", description: "Camera de-initialization failed" },
  { bit: 26, maskHex: "0x0000000004000000", name: "IC_ERR_CAM_CAPTURE_FAILED", category: "Camera", description: "Frame capture failed" },
  { bit: 27, maskHex: "0x0000000008000000", name: "IC_ERR_CAM_FORMAT_INVALID", category: "Camera", description: "Captured frame format not as expected" },
  { bit: 28, maskHex: "0x0000000010000000", name: "IC_ERR_CAM_HDR_INVALID_ARGS", category: "Camera", description: "applyHDR called with invalid arguments" },
  { bit: 29, maskHex: "0x0000000020000000", name: "IC_ERR_CAM_HDR_NOT_GRAYSCALE", category: "Camera", description: "HDR frame was not grayscale when expected" },
  { bit: 30, maskHex: "0x0000000040000000", name: "IC_ERR_CAM_HDR_CAPTURE_FAILED", category: "Camera", description: "HDR capture of additional frame failed" },
  { bit: 31, maskHex: "0x0000000080000000", name: "IC_ERR_CAM_HDR_SIZE_MISMATCH", category: "Camera", description: "HDR frame sizes mismatched base frame" },
  { bit: 32, maskHex: "0x0000000100000000", name: "IC_ERR_OBJ_LABELS_NULL", category: "ObjectDetect", description: "Labels pointer is NULL" },
  { bit: 33, maskHex: "0x0000000200000000", name: "IC_ERR_OBJ_BINARY_IMAGE_NULL", category: "ObjectDetect", description: "Binary image pointer is NULL" },
  { bit: 34, maskHex: "0x0000000400000000", name: "IC_ERR_OBJ_INVALID_BBOX_DIM", category: "ObjectDetect", description: "Invalid bounding box dimensions" },
  { bit: 35, maskHex: "0x0000000800000000", name: "IC_ERR_OBJ_ROI_ALLOC_FAIL", category: "ObjectDetect", description: "Allocation of ROI buffer failed" },
  { bit: 36, maskHex: "0x0000001000000000", name: "IC_ERR_OBJ_RESIZED_ROI_ALLOC_FAIL", category: "ObjectDetect", description: "Allocation of resized ROI buffer failed" },
  { bit: 37, maskHex: "0x0000002000000000", name: "IC_ERR_OBJ_TEMPBUF_ALLOC_FAIL", category: "ObjectDetect", description: "Allocation of temporary buffer failed" },
  { bit: 38, maskHex: "0x0000004000000000", name: "IC_ERR_OBJ_DISPLAY_ALLOC_FAIL", category: "ObjectDetect", description: "Allocation of display/preview buffer failed" },
  { bit: 39, maskHex: "0x0000008000000000", name: "IC_ERR_OBJ_INFERENCE_TIMEOUT", category: "ObjectDetect", description: "Inference pipeline exceeded time limit" },
  { bit: 40, maskHex: "0x0000010000000000", name: "IC_ERR_OCR_MODEL_ALREADY_INIT", category: "OCR", description: "Attempted to initialize OCR model twice" },
  { bit: 41, maskHex: "0x0000020000000000", name: "IC_ERR_OCR_MODEL_LOAD", category: "OCR", description: "Failed to load TensorFlow Lite OCR model" },
  { bit: 42, maskHex: "0x0000040000000000", name: "IC_ERR_OCR_TENSOR_ALLOC", category: "OCR", description: "Failed to allocate TFLite tensors" },
  { bit: 43, maskHex: "0x0000080000000000", name: "IC_ERR_OCR_INPUT_MISMATCH", category: "OCR", description: "Input tensor type/shape mismatch" },
  { bit: 44, maskHex: "0x0000100000000000", name: "IC_ERR_OCR_NOT_INITIALIZED", category: "OCR", description: "OCR model used before initialization" },
  { bit: 45, maskHex: "0x0000200000000000", name: "IC_ERR_OCR_INPUT_SIZE_MISMATCH", category: "OCR", description: "Input tensor byte size mismatch" },
  { bit: 46, maskHex: "0x0000400000000000", name: "IC_ERR_OCR_RUN_FAIL", category: "OCR", description: "Interpreter Invoke() failed" },
  { bit: 47, maskHex: "0x0000800000000000", name: "IC_ERR_OCR_VALUE_MONOTONIC_FAIL", category: "OCR", description: "Digit value violated monotonicity assumption" },
  { bit: 48, maskHex: "0x0001000000000000", name: "IC_ERR_READING_INVALID", category: "Validation", description: "Reading string or parsed value considered invalid" },
  { bit: 49, maskHex: "0x0002000000000000", name: "IC_ERR_READING_OUT_OF_BOUNDS", category: "Validation", description: "Reading outside configured plausible range" },
  { bit: 50, maskHex: "0x0004000000000000", name: "IC_ERR_RESULTS_ARRAY_FULL", category: "Validation", description: "Results array filled before processing completed" },
  { bit: 51, maskHex: "0x0008000000000000", name: "IC_ERR_MOST_FREQ_ALLOC_FAIL", category: "Validation", description: "Allocation failed in most-frequent-digit logic" },
  { bit: 52, maskHex: "0x0010000000000000", name: "IC_ERR_INFERENCE_TOO_SLOW", category: "Validation", description: "End-to-end inference time exceeded threshold" },
  { bit: 53, maskHex: "0x0020000000000000", name: "IC_ERR_DEVICE_FAILURE_COUNT_INC", category: "Validation", description: "Device failure / failed_capture_count incremented" },
  { bit: 54, maskHex: "0x0040000000000000", name: "IC_ERR_ZERO_CROSSING_ADJUSTED", category: "Validation", description: "Zero-crossing adjustment applied to fractional digits" },
  { bit: 55, maskHex: "0x0080000000000000", name: "IC_ERR_PATCH_SUCCESS", category: "Validation", description: "Patch/OCR correction applied and accepted" },
  { bit: 56, maskHex: "0x0100000000000000", name: "IC_ERR_LORA_UART_INIT_FAIL", category: "LoRa", description: "UART initialization for LoRa-E5 failed" },
  { bit: 57, maskHex: "0x0200000000000000", name: "IC_ERR_LORA_JOIN_FAIL", category: "LoRa", description: "OTAA join failed after retries" },
  { bit: 58, maskHex: "0x0400000000000000", name: "IC_ERR_LORA_SEND_FAIL", category: "LoRa", description: "LoRa uplink send failed" },
  { bit: 59, maskHex: "0x0800000000000000", name: "IC_ERR_LORA_NOT_JOINED", category: "LoRa", description: "Uplink attempt while device not joined" },
  { bit: 60, maskHex: "0x1000000000000000", name: "IC_ERR_LORA_NO_RESPONSE", category: "LoRa", description: "No response from LoRa module after uplink" },
  { bit: 61, maskHex: "0x2000000000000000", name: "IC_ERR_LORA_ACK_TIMEOUT", category: "LoRa", description: "ACK not received / timed out for confirmed uplink" },
  { bit: 62, maskHex: "0x4000000000000000", name: "IC_ERR_OTA_ROLLBACK", category: "OTA/HTTP", description: "Device booted into OTA rollback / fallback image" },
  { bit: 63, maskHex: "0x8000000000000000", name: "IC_ERR_HTTP_WEBHOOK_POST_FAIL", category: "OTA/HTTP", description: "Webhook POST to backend failed" },
]

const FAILURE_OVERDUE_THRESHOLD_SEC = 40

/**
 * Strips a raw meter string to a zero-padded digit-only form (no comma/dot).
 * e.g. "22488,930" → "22488930", "22489.160" → "22489160"
 */
function rawToDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).replace(/[,.\s]/g, "")
  if (!/^\d+$/.test(s)) return null
  return s
}

/**
 * Diagnose _why_ the uplink was delayed based on the OCR device validation rules.
 *
 * Rules (from IC_ocr.cpp):
 *  1. ROLLOVER FIX  — ≥3 trailing digits changed AND an old digit was 8/9
 *     with a new digit of 0 → device applied rollover correction & retried
 *  2. OVERLIMIT     — increase (new − old) exceeded max_increase_allowed
 *  3. ROLLBACK      — new value < old value (string compare), device retried
 *  4. OCR FAILURE   — raw value contains 'X' or is missing
 *  5. DEVICE ERROR  — error event hex codes present
 */
function diagnoseFailureReason(
  prevRaw: string | null | undefined,
  curRaw: string | null | undefined,
  prevValue: number | null | undefined,
  curValue: number | null | undefined,
  errorHex: string | null,
  warningHex: string | null,
  exceededBySec: number,
  expectedIntervalSec: number,
): string {
  const reasons: string[] = []

  // Check OCR failure (null values or X in raw)
  if (curRaw == null || curValue == null) {
    reasons.push("OCR failure: device could not produce a valid reading")
  } else if (typeof curRaw === "string" && /x/i.test(curRaw)) {
    reasons.push("OCR failure: raw value contains unrecognised digits ('X')")
  }

  const oldDigits = rawToDigits(prevRaw ?? undefined)
  const newDigits = rawToDigits(curRaw ?? undefined)

  if (oldDigits && newDigits && oldDigits.length === newDigits.length) {
    const n = oldDigits.length

    // Count consecutive trailing positions that differ (same logic as IC_ocr.cpp)
    let tail = 0
    for (let p = n - 1; p >= 0; --p) {
      if (newDigits[p] !== oldDigits[p]) tail++
      else break
    }

    const carryPos = n - tail

    // Check for 8/9 → 0 artifact in the changed tail (rollover signature)
    let has8or9Artifact = false
    if (tail >= 3) {
      for (let p = carryPos; p < n; p++) {
        if ((oldDigits[p] === "8" || oldDigits[p] === "9") && newDigits[p] === "0") {
          has8or9Artifact = true
          break
        }
      }
      // Also check if carry digit was 8→9 or 9→0
      const carryIs8or9 = carryPos < n &&
        (oldDigits[carryPos] === "8" || oldDigits[carryPos] === "9")

      if (has8or9Artifact && carryIs8or9) {
        reasons.push(
          `Stuck in rollover fix: ${tail} trailing digits changed ` +
          `(carry pos ${carryPos}: '${oldDigits[carryPos]}'→'${newDigits[carryPos]}') — ` +
          `device detected mechanical rollover and retried OCR`,
        )
      } else if (has8or9Artifact) {
        reasons.push(
          `Possible rollover: ${tail} trailing digits changed with 8/9→0 artifact`,
        )
      }
    }

    // Check ROLLBACK (new < old by string compare)
    if (newDigits < oldDigits && !reasons.some((r) => r.includes("rollover"))) {
      reasons.push(
        `Rollback path: reading decreased (old: ${oldDigits}, new: ${newDigits}) — ` +
        `device retried validation`,
      )
    }

    // Check OVERLIMIT — rough estimate using Qmax=6 m³/h and actual interval
    // max_increase_allowed = (1000/scalar) * (qmax * (interval/3600))
    // We estimate scalar from decimal places in raw value
    if (prevValue != null && curValue != null && curValue > prevValue) {
      const actualSec = expectedIntervalSec + exceededBySec
      // Conservative Qmax = 6 m³/h, estimate with 1 decimal (scalar=10)
      const maxIncreaseEstimate = 6 * (actualSec / 3600)
      const diff = curValue - prevValue
      if (diff > maxIncreaseEstimate * 1.5) {
        reasons.push(
          `Possible overlimit: Δ=${diff.toFixed(3)} m³ exceeds estimated max ` +
          `(~${maxIncreaseEstimate.toFixed(1)} m³ for ${actualSec}s at Qmax=6 m³/h)`,
        )
      }
    }
  }

  // Check device error codes
  if (errorHex && !/^0+$/.test(errorHex)) {
    const decoded = decodeEventBySeverity(errorHex, "ERROR")
    if (decoded) {
      reasons.push(`Device error: ${decoded.name} — ${decoded.description}`)
    }
  }
  if (warningHex && !/^0+$/.test(warningHex)) {
    const decoded = decodeEventBySeverity(warningHex, "WARN")
    if (decoded) {
      reasons.push(`Device warning: ${decoded.name} — ${decoded.description}`)
    }
  }

  if (reasons.length === 0) {
    // Fall back: just note the raw values for manual inspection
    const lastStr = prevRaw ? `last raw: ${prevRaw}` : "last: n/a"
    const newStr = curRaw ? `new raw: ${curRaw}` : "new: n/a"
    return `Took longer than expected (${lastStr}, ${newStr}) — cause unknown`
  }

  return reasons.join("; ")
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function findKeyDeep(root: unknown, key: string, depth = 0): unknown {
  if (depth > 4 || root == null) return undefined
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findKeyDeep(item, key, depth + 1)
      if (found !== undefined) return found
    }
    return undefined
  }
  const rec = asRecord(root)
  if (!rec) return undefined
  if (key in rec) return rec[key]
  for (const value of Object.values(rec)) {
    const found = findKeyDeep(value, key, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

function normalizeHex(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number" && typeof v !== "bigint") return null
  let s = String(v).trim()
  if (!s) return null
  s = s.replace(/^0x/i, "")
  if (!/^[0-9a-fA-F]+$/.test(s)) return null
  return s.toUpperCase()
}

function decodeEventBySeverity(hex: string | null, severity: "ERROR" | "WARN" | "INFO"): DecodedHexEvent | null {
  if (!hex || /^0+$/.test(hex)) return null
  const codeHex = hex.padStart(4, "0")
  const table = severity === "ERROR" ? ERROR_EVENT_CODES : severity === "WARN" ? WARN_EVENT_CODES : INFO_EVENT_CODES
  const def = table[codeHex]
  if (!def) {
    return {
      codeHex,
      severity,
      name: "UNKNOWN_CODE",
      description: "Code not present in configured mapping",
    }
  }
  return {
    codeHex,
    severity,
    name: def.name,
    description: def.description,
  }
}

function decodeErrorBitmask(hex: string | null): DecodedBitmaskFlag[] {
  if (!hex || /^0+$/.test(hex)) return []
  try {
    const value = BigInt(`0x${hex}`)
    const active: DecodedBitmaskFlag[] = []
    for (const def of ERROR_BITMASK_CODES) {
      const mask = BigInt(1) << BigInt(def.bit)
      if ((value & mask) !== BigInt(0)) {
        active.push({
          bit: def.bit,
          maskHex: def.maskHex,
          name: def.name,
          category: def.category,
          description: def.description,
        })
      }
    }
    return active
  } catch {
    return []
  }
}

function getHexFromUplink(uplink: Uplink, key: "error_event_hex" | "warning_event_hex" | "info_event_hex"): string | null {
  const decoded = asRecord(uplink.decoded_json)
  const payload = asRecord(uplink.payload_json)
  const fromDecoded = findKeyDeep(decoded, key)
  const fromPayload = findKeyDeep(payload, key)
  return normalizeHex(fromDecoded ?? fromPayload)
}

function resolveExpectedIntervalSec(uplinks: Uplink[], provided?: number | null): number {
  if (provided != null && Number.isFinite(provided) && provided > 0) return Math.round(provided)
  if (uplinks.length < 3) return 120

  const times = uplinks
    .map((u) => new Date(u.at).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)

  const diffs: number[] = []
  for (let i = 1; i < times.length; i++) {
    const sec = Math.round((times[i] - times[i - 1]) / 1000)
    if (sec > 0) diffs.push(sec)
  }
  if (!diffs.length) return 120

  const sorted = diffs.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function analyzeUplinkFailures(uplinks: Uplink[], expectedIntervalSecInput?: number | null): {
  expectedIntervalSec: number
  failures: UploadFailureLog[]
} {
  const sorted = uplinks
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const expectedIntervalSec = resolveExpectedIntervalSec(sorted, expectedIntervalSecInput)
  const failures: UploadFailureLog[] = []

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const current = sorted[i]
    const prevMs = new Date(prev.at).getTime()
    const curMs = new Date(current.at).getTime()
    if (!Number.isFinite(prevMs) || !Number.isFinite(curMs) || curMs <= prevMs) continue

    const actualIntervalSec = Math.round((curMs - prevMs) / 1000)
    const exceededBySec = actualIntervalSec - expectedIntervalSec
    if (exceededBySec < FAILURE_OVERDUE_THRESHOLD_SEC) continue

    const errorEventHex = getHexFromUplink(current, "error_event_hex")
    const warningEventHex = getHexFromUplink(current, "warning_event_hex")
    const infoEventHex = getHexFromUplink(current, "info_event_hex")

    const failureReason = diagnoseFailureReason(
      prev.meter_value_raw,
      current.meter_value_raw,
      prev.meter_value,
      current.meter_value,
      errorEventHex,
      warningEventHex,
      exceededBySec,
      expectedIntervalSec,
    )

    failures.push({
      id: `${current.id}-${current.at}`,
      devEui: current.dev_eui,
      previousAt: prev.at,
      at: current.at,
      expectedIntervalSec,
      actualIntervalSec,
      exceededBySec,
      errorEventHex,
      warningEventHex,
      infoEventHex,
      decodedErrorEvent: decodeEventBySeverity(errorEventHex, "ERROR"),
      decodedWarningEvent: decodeEventBySeverity(warningEventHex, "WARN"),
      decodedInfoEvent: decodeEventBySeverity(infoEventHex, "INFO"),
      decodedErrorFlags: decodeErrorBitmask(errorEventHex),
      previousMeterValue: prev.meter_value,
      previousMeterValueRaw: prev.meter_value_raw,
      currentMeterValue: current.meter_value,
      currentMeterValueRaw: current.meter_value_raw,
      previousBatteryMv: prev.battery_mv,
      currentBatteryMv: current.battery_mv,
      failureReason,
      payload: asRecord(current.decoded_json) ?? asRecord(current.payload_json),
    })
  }

  return { expectedIntervalSec, failures }
}