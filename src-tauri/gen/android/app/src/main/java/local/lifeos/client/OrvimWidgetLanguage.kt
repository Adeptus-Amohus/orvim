package local.lifeos.client

import android.content.Context
import java.util.Locale

object OrvimWidgetLanguage {
  fun english(context:Context)=context.getSharedPreferences("orvim_widgets",Context.MODE_PRIVATE).getString("language",Locale.getDefault().language)=="en"
  private val errors=mapOf(
    "Сначала подключите ИИ в настройках Orvim. Ручная запись доступна." to "Connect AI in Orvim settings first. Manual entry is available.",
    "Этот провайдер пока не поддерживается в виджете. Введите калории вручную." to "This provider is not supported in the widget yet. Enter calories manually.",
    "Выберите модель ИИ в настройках Orvim." to "Choose an AI model in Orvim settings.",
    "ИИ отклонил ключ. Проверьте подключение в настройках Orvim." to "AI rejected the key. Check the connection in Orvim settings.",
    "Лимит провайдера ИИ. Попробуйте позже или введите калории вручную." to "AI provider limit reached. Try later or enter calories manually.",
    "ИИ временно недоступен. Введите калории вручную или повторите позже." to "AI is temporarily unavailable. Enter calories manually or try later.",
    "Слишком большой ответ ИИ" to "The AI response is too large",
    "ИИ вернул непонятную оценку. Повторите или заполните вручную." to "AI returned an invalid estimate. Retry or fill in manually.",
    "ИИ не вернул продукты. Можно заполнить вручную." to "AI returned no food items. You can fill them in manually.",
    "Не удалось проверить название блюда ИИ." to "Could not validate the AI meal name.",
    "Не удалось проверить КБЖУ ИИ. Повторите или заполните вручную." to "Could not validate AI nutrition values. Retry or fill in manually.",
    "Слишком много записей: откройте Orvim для переноса в базу." to "Too many pending entries. Open Orvim to move them into the database.",
    "Слишком большой журнал виджетов" to "The widget journal is too large"
  )
  fun message(context:Context,value:String):String {
    if(!english(context))return value
    return errors[value] ?: if(Regex("[А-Яа-яЁё]").containsMatchIn(value))"Could not complete this action. Try again." else value
  }
}
