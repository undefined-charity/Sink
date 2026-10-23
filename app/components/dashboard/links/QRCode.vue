<script setup lang="ts">
import { Download } from '@lucide/vue'
import QRCodeStyling from 'qr-code-styling'

const props = withDefaults(defineProps<{
  data: string
  image?: string
}>(), {
  image: '',
})
const color = ref('#000000')

// undefined-charity fork: centre logo. NUXT_PUBLIC_QR_LOGO (a URL or /path)
// is the default for every QR code; the picker overrides it per download.
const defaultLogo = useRuntimeConfig().public.qrLogo as string
type LogoChoice = 'default' | 'site' | 'none' | 'custom'
const logoChoice = ref<LogoChoice>(defaultLogo ? 'default' : 'site')
const customLogo = ref('')
const logoInput = useTemplateRef<HTMLInputElement>('logoInput')

function logoFor(choice: LogoChoice): string {
  if (choice === 'default')
    return defaultLogo
  if (choice === 'site')
    return props.image
  if (choice === 'custom')
    return customLogo.value
  return ''
}

function onLogoPicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  // A data URL keeps the canvas untainted so the PNG download still works.
  const reader = new FileReader()
  reader.onload = () => {
    customLogo.value = String(reader.result)
    logoChoice.value = 'custom'
  }
  reader.readAsDataURL(file)
}

const options = {
  width: 256,
  height: 256,
  data: props.data,
  type: 'svg' as const,
  margin: 10,
  qrOptions: { typeNumber: 0 as const, mode: 'Byte' as const, errorCorrectionLevel: 'Q' as const },
  imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 2 },
  dotsOptions: { type: 'dots' as const, color: '#000000' },
  backgroundOptions: { color: '#ffffff' },
  image: logoFor(logoChoice.value) || undefined,
  cornersSquareOptions: { type: 'extra-rounded' as const, color: '#000000' },
  cornersDotOptions: { type: 'dot' as const, color: '#000000' },
}

const qrCode = new QRCodeStyling(options)

watch([logoChoice, customLogo], ([choice]) => {
  if (choice === 'custom' && !customLogo.value) {
    logoInput.value?.click()
    return
  }
  qrCode.update({ image: logoFor(choice) || undefined })
})
const qrCodeEl = useTemplateRef<HTMLElement>('qrCodeEl')

function updateColor(newColor: string) {
  qrCode.update({
    dotsOptions: { type: 'dots' as const, color: newColor },
    cornersSquareOptions: { type: 'extra-rounded' as const, color: newColor },
    cornersDotOptions: { type: 'dot' as const, color: newColor },
  })
}

watch(color, (newColor) => {
  updateColor(newColor)
})

function downloadQRCode() {
  const slug = props.data.split('/').pop()
  qrCode.download({
    extension: 'png',
    name: `qr_${slug}`,
  })
}

onMounted(() => {
  if (qrCodeEl.value) {
    qrCode.append(qrCodeEl.value as unknown as HTMLElement)
  }
})
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div
      ref="qrCodeEl"
      :data-text="data"
      role="img"
      :aria-label="$t('links.qr.text_alternative', { url: data })"
      class="rounded-lg border border-border bg-white p-1 shadow-sm"
    />
    <div class="flex items-center gap-2 text-sm">
      <label for="qr-logo" class="text-muted-foreground">Logo</label>
      <select
        id="qr-logo" v-model="logoChoice" class="
          h-8 rounded-md border bg-background px-2
        "
      >
        <option v-if="defaultLogo" value="default">
          Undefined
        </option>
        <option value="site">
          Site icon
        </option>
        <option value="none">
          None
        </option>
        <option value="custom">
          Upload…
        </option>
      </select>
      <input
        ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="
          hidden
        " @change="onLogoPicked"
      >
    </div>
    <div class="flex items-center gap-4">
      <div class="relative flex items-center">
        <label
          class="
            relative size-11 cursor-pointer overflow-hidden rounded-full border
            border-input ring-offset-background
            focus-within:ring-3 focus-within:ring-ring/50
            lg:size-9
          "
          :style="{ backgroundColor: color }"
          :title="$t('links.change_qr_color')"
        >
          <input
            v-model="color"
            type="color"
            class="absolute inset-0 size-full cursor-pointer opacity-0"
            :aria-label="$t('links.change_qr_color')"
            :title="$t('links.change_qr_color')"
          >
        </label>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="
          min-h-11
          lg:min-h-8
        "
        @click="downloadQRCode"
      >
        <Download aria-hidden="true" class="mr-2 size-4" />
        {{ $t('links.download_qr_code') }}
      </Button>
    </div>
  </div>
</template>
