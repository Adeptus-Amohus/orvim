package local.lifeos.client

import android.app.Activity
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Button

class HealthRationaleActivity: Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(40, 64, 40, 40) }
    val russian = resources.configuration.locales[0].language == "ru"
    layout.addView(TextView(this).apply { textSize = 22f; text = if(russian) "Orvim · данные здоровья" else "Orvim · health data" })
    layout.addView(TextView(this).apply {
      textSize = 16f; setPadding(0, 32, 0, 32)
      text = if(russian) "Orvim читает только разрешённые вами шаги, длительность сна и тренировки из Health Connect. Эти записи хранятся на устройстве. Пульс, маршруты, местоположение и медицинские записи не запрашиваются.\n\nOrvim не записывает данные обратно в Health Connect. Разрешения можно отозвать в настройках Android. Вы также можете отключить импорт в Orvim, сохранив уже полученную историю.\n\nДанные попадут на другое устройство, в резервную копию или к ИИ только при использовании соответствующих функций, выбранных вами. Резервные копии JSON не зашифрованы; защищайте доступ к ним. Никакие данные не продаются и не используются для рекламы."
        else "Orvim reads only the steps, sleep duration and workout sessions you permit in Health Connect. Records are stored on your device. Heart rate, routes, location and medical records are not requested.\n\nOrvim does not write back to Health Connect. Revoke permissions in Android settings, or disable import in Orvim while retaining your history.\n\nRecords are shared with another device, included in a backup, or sent to AI only through the corresponding features you choose. JSON backups are not encrypted; protect access to them. Data is not sold or used for advertising."
    })
    layout.addView(Button(this).apply { text = if(russian) "Закрыть" else "Close"; setOnClickListener { finish() } })
    val scroll = android.widget.ScrollView(this); scroll.addView(layout); setContentView(scroll)
  }
}
