<script setup lang="ts">
// undefined-charity fork: editor for the one-page event site a link can serve
// instead of redirecting. Saved by the link form after the link itself.
import type { EventPage } from '#shared/schemas/event-page'
import { Eye, ImagePlus, Loader2, MousePointerClick, Quote } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { defaultEventPage } from '#shared/schemas/event-page'
import { renderEventPageHtml } from '#shared/utils/event-page-render'
import { IMAGE_ALLOWED_TYPES, IMAGE_MAX_SIZE } from '#shared/utils/image'

const props = defineProps<{
  slug: string
  idPrefix: string
  /** Suggested title when a page is first switched on. */
  titleHint?: string
}>()

const enabled = defineModel<boolean>('enabled', { required: true })
const page = defineModel<EventPage>('page', { required: true })

const { shortUrl } = useShortDomains()
const canUpload = computed(() => !!props.slug.trim())
const bodyInput = useTemplateRef<{ $el: HTMLTextAreaElement } | HTMLTextAreaElement>('bodyInput')
const imageInput = useTemplateRef<HTMLInputElement>('imageInput')
const uploading = ref(false)
const previewOpen = ref(false)

watch(enabled, (on) => {
  if (on && !page.value.title)
    page.value = { ...defaultEventPage(props.titleHint ?? ''), ...pickFilled(page.value) }
})

function pickFilled(value: EventPage): Partial<EventPage> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== '' && v !== undefined)) as Partial<EventPage>
}

function update<K extends keyof EventPage>(key: K, value: EventPage[K]) {
  page.value = { ...page.value, [key]: value }
}

function textarea(): HTMLTextAreaElement | null {
  const el = bodyInput.value
  if (!el)
    return null
  return el instanceof HTMLTextAreaElement ? el : el.$el
}

function insertAtCursor(snippet: string) {
  const el = textarea()
  const body = page.value.body
  const start = el?.selectionStart ?? body.length
  const end = el?.selectionEnd ?? body.length
  const before = body.slice(0, start)
  const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  const next = `${before}${pad}${snippet}\n\n${body.slice(end).replace(/^\n+/, '')}`
  update('body', next)
  nextTick(() => {
    const cursor = before.length + pad.length + snippet.length
    el?.focus()
    el?.setSelectionRange(cursor, cursor)
  })
}

async function uploadInlineImage(file: File) {
  if (!canUpload.value) {
    toast.error('Pick the short link first — images are stored under it.')
    return
  }
  if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
    toast.error('Images must be JPEG, PNG, WebP or GIF.')
    return
  }
  if (file.size > IMAGE_MAX_SIZE) {
    toast.error('Images must be 5 MB or smaller.')
    return
  }
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('slug', props.slug)
    const { url } = await useAPI<{ url: string }>('/api/upload/image', { method: 'POST', body: formData })
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
    insertAtCursor(`![${alt}](${url} "Caption (optional)")`)
  }
  catch (error) {
    console.error(error)
    toast.error('Image upload failed', { description: error instanceof Error ? error.message : String(error) })
  }
  finally {
    uploading.value = false
    if (imageInput.value)
      imageInput.value.value = ''
  }
}

function onImagePicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file)
    void uploadInlineImage(file)
}

const previewHtml = computed(() => {
  if (!previewOpen.value)
    return ''
  const slug = props.slug || 'preview'
  const origin = window.location.origin
  return renderEventPageHtml(
    { ...page.value, title: page.value.title || 'Untitled event' },
    { slug, pageUrl: shortUrl(slug), assetOrigin: origin, shortUrl },
  )
})
</script>

<template>
  <section class="space-y-4 rounded-2xl border p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <Label :for="`${idPrefix}-event-page`" class="text-base">Event page</Label>
        <p class="text-sm text-muted-foreground">
          Show a one-page event site at this link instead of redirecting. Visits still count in analytics.
        </p>
      </div>
      <Switch :id="`${idPrefix}-event-page`" v-model="enabled" />
    </div>

    <template v-if="enabled">
      <FieldGroup>
        <Field>
          <FieldLabel :for="`${idPrefix}-ep-title`">
            Title
          </FieldLabel>
          <Input :id="`${idPrefix}-ep-title`" :model-value="page.title" placeholder="Frostbite After Dark" @update:model-value="update('title', String($event))" />
        </Field>
        <Field>
          <FieldLabel :for="`${idPrefix}-ep-when`">
            When
          </FieldLabel>
          <Input :id="`${idPrefix}-ep-when`" :model-value="page.when" placeholder="Saturday, January 16 2027 · 11:00 PM – 2:00 AM" @update:model-value="update('when', String($event))" />
        </Field>
        <div
          class="
            grid gap-4
            sm:grid-cols-2
          "
        >
          <Field>
            <FieldLabel :for="`${idPrefix}-ep-where`">
              Where
            </FieldLabel>
            <Input :id="`${idPrefix}-ep-where`" :model-value="page.where" placeholder="The Kink Center" @update:model-value="update('where', String($event))" />
          </Field>
          <Field>
            <FieldLabel :for="`${idPrefix}-ep-where-url`">
              Map link (optional)
            </FieldLabel>
            <Input :id="`${idPrefix}-ep-where-url`" :model-value="page.whereUrl" inputmode="url" placeholder="https://maps.apple.com/…" @update:model-value="update('whereUrl', String($event))" />
          </Field>
        </div>
        <Field>
          <FieldLabel :for="`${idPrefix}-ep-host`">
            Hosted by
          </FieldLabel>
          <Input :id="`${idPrefix}-ep-host`" :model-value="page.host" placeholder="Brought to you by Undefined, led by …" @update:model-value="update('host', String($event))" />
        </Field>

        <Field>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel :for="`${idPrefix}-ep-body`">
              Page content
            </FieldLabel>
            <div class="flex flex-wrap gap-1">
              <Button type="button" variant="ghost" size="sm" :disabled="uploading || !canUpload" @click="imageInput?.click()">
                <Loader2
                  v-if="uploading" class="
                    size-4
                    motion-safe:animate-spin
                  " aria-hidden="true"
                />
                <ImagePlus v-else class="size-4" aria-hidden="true" />
                Insert image
              </Button>
              <Button type="button" variant="ghost" size="sm" @click="insertAtCursor('[Button label](/rsvp)')">
                <MousePointerClick class="size-4" aria-hidden="true" />
                Button
              </Button>
              <Button type="button" variant="ghost" size="sm" @click="insertAtCursor('> ### Heading\n> Text for the highlighted box.')">
                <Quote class="size-4" aria-hidden="true" />
                Box
              </Button>
            </div>
          </div>
          <input
            ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="
              hidden
            " @change="onImagePicked"
          >
          <Textarea
            :id="`${idPrefix}-ep-body`"
            ref="bodyInput"
            :model-value="page.body"
            rows="16"
            class="font-mono text-sm"
            spellcheck="true"
            @update:model-value="update('body', String($event))"
          />
          <FieldDescription>
            Markdown: <code>## Heading</code>, <code>- list</code>, <code>**bold**</code>.
            A link on its own line becomes a button; <code>/rsvp</code> and <code>/donate</code> point at this event's own
            links. A <code>&gt;</code> quote becomes a highlighted box.
            <span v-if="!canUpload">Pick the short link above to enable image uploads.</span>
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel :for="`${idPrefix}-ep-hero`">
            Header image (optional)
          </FieldLabel>
          <DashboardLinksEditorImageUploader
            :model-value="page.hero"
            :slug="slug"
            :input-id="`${idPrefix}-ep-hero`"
            @update:model-value="update('hero', $event || '')"
          />
          <FieldDescription>Also used as the preview image when the link is shared.</FieldDescription>
        </Field>

        <div
          class="
            grid gap-4
            sm:grid-cols-2
          "
        >
          <Field>
            <FieldLabel :for="`${idPrefix}-ep-bg`">
              Theme
            </FieldLabel>
            <Select :model-value="page.background" @update:model-value="update('background', $event as EventPage['background'])">
              <SelectTrigger :id="`${idPrefix}-ep-bg`" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="undefined">
                  Undefined (pink sky)
                </SelectItem>
                <SelectItem value="light">
                  Light
                </SelectItem>
                <SelectItem value="dark">
                  Dark
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel :for="`${idPrefix}-ep-accent`">
              Accent color
            </FieldLabel>
            <div class="flex items-center gap-2">
              <input
                :id="`${idPrefix}-ep-accent`"
                type="color"
                class="
                  h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1
                "
                :value="page.accent"
                @input="update('accent', ($event.target as HTMLInputElement).value)"
              >
              <Input :model-value="page.accent" class="font-mono" aria-label="Accent color hex" @update:model-value="update('accent', String($event))" />
            </div>
          </Field>
        </div>
      </FieldGroup>

      <Button type="button" variant="outline" class="w-full" @click="previewOpen = true">
        <Eye class="size-4" aria-hidden="true" />
        Preview page
      </Button>
    </template>

    <Dialog v-model:open="previewOpen">
      <DialogContent
        class="
          flex h-[90svh] max-w-[min(1100px,95vw)] flex-col gap-3 p-3
          sm:max-w-[min(1100px,95vw)]
        "
      >
        <DialogHeader class="px-2 pt-1">
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription>Buttons and images work as on the live page. Save the link to publish.</DialogDescription>
        </DialogHeader>
        <iframe
          v-if="previewOpen"
          title="Event page preview"
          class="min-h-0 w-full flex-1 rounded-lg border bg-white"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          :srcdoc="previewHtml"
        />
      </DialogContent>
    </Dialog>
  </section>
</template>
