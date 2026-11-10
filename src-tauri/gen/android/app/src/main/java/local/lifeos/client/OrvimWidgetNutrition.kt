package local.lifeos.client

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.net.ssl.HttpsURLConnection

/** Food-only estimation; no database context or arbitrary model actions. */
object OrvimWidgetNutrition {
  private fun credential(context:Context,provider:String):String {
    val raw=context.getSharedPreferences("life_credentials",Context.MODE_PRIVATE).getString(provider,null) ?: error("Сначала подключите ИИ в настройках Orvim. Ручная запись доступна.")
    val parts=raw.split(":")
    val store=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
    val key=store.getKey("life-os-connections",null) as SecretKey
    val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.DECRYPT_MODE,key,GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)))}
    return String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),Charsets.UTF_8)
  }
  fun estimate(context:Context,text:String):List<JSONObject> {
    require(text.length<=10000)
    val settings=OrvimWidgets.read(context).optJSONObject("ai") ?: JSONObject()
    val provider=settings.optString("provider","openai")
    require(provider in listOf("openai","deepseek","gemini")){"Этот провайдер пока не поддерживается в виджете. Введите калории вручную."}
    val model=settings.optString("model")
    require(Regex("^[a-zA-Z0-9._:/-]{1,160}$").matches(model)){"Выберите модель ИИ в настройках Orvim."}
    val key=credential(context,provider)
    val prompt="Estimate the described meals and food using ordinary portion sizes when unspecified. Do not ask questions. Return ONLY JSON {\"items\":[{\"name\":\"food and portion\",\"calories\":123,\"protein\":4.5,\"fat\":2,\"carbs\":20}]}, at most 20 items. Calories in kcal and protein/fat/carbs in grams for the entire consumed portion, never per 100g unless that was consumed. All results are approximate. Keep names in the user's language. Do not output application actions or IDs. Food: "+text
    val address=when(provider){"gemini"->"https://generativelanguage.googleapis.com/v1beta/models/"+android.net.Uri.encode(model.removePrefix("models/"))+":generateContent";"deepseek"->"https://api.deepseek.com/chat/completions";else->"https://api.openai.com/v1/chat/completions"}
    val body=if(provider=="gemini")JSONObject().put("contents",JSONArray().put(JSONObject().put("parts",JSONArray().put(JSONObject().put("text",prompt)))))else JSONObject().put("model",model).put("messages",JSONArray().put(JSONObject().put("role","user").put("content",prompt)))
    val connection=URL(address).openConnection() as HttpsURLConnection
    try{
      connection.requestMethod="POST";connection.instanceFollowRedirects=false;connection.connectTimeout=20000;connection.readTimeout=45000;connection.doOutput=true
      connection.setRequestProperty("Content-Type","application/json")
      if(provider=="gemini")connection.setRequestProperty("x-goog-api-key",key)else connection.setRequestProperty("Authorization","Bearer $key")
      connection.outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
      val code=connection.responseCode
      if(code !in 200..299)error(when(code){401,403->"ИИ отклонил ключ. Проверьте подключение в настройках Orvim.";429->"Лимит провайдера ИИ. Попробуйте позже или введите калории вручную.";else->"ИИ временно недоступен. Введите калории вручную или повторите позже."})
      val bytes=connection.inputStream.use{input->val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192);while(true){val count=input.read(buffer);if(count<0)break;out.write(buffer,0,count);require(out.size()<=1_000_000){"Слишком большой ответ ИИ"}};out.toByteArray()}
      require(bytes.size<=1_000_000){"Слишком большой ответ ИИ"}
      val response=JSONObject(String(bytes,Charsets.UTF_8))
      val content=if(provider=="gemini")response.getJSONArray("candidates").getJSONObject(0).getJSONObject("content").getJSONArray("parts").getJSONObject(0).getString("text")else response.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content")
      return parseEstimate(content)
    }finally{connection.disconnect()}
  }
  fun parseEstimate(content:String):List<JSONObject> {
    val clean=content.trim().removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
    val rows=try{JSONObject(clean).getJSONArray("items")}catch(_:Exception){error("ИИ вернул непонятную оценку. Повторите или заполните вручную.")}
    require(rows.length() in 1..20){"ИИ не вернул продукты. Можно заполнить вручную."}
    return (0 until rows.length()).map{i->
      val row=rows.getJSONObject(i);val name=row.optString("name").trim()
      val result=JSONObject().put("text",name)
      require(name.isNotEmpty() && name.length<=180){"Не удалось проверить название блюда ИИ."}
      for(field in listOf("calories","protein","fat","carbs")){
        val value=row.optDouble(field,Double.NaN)
        require(value.isFinite() && value>=0 && value<=if(field=="calories")10000 else 2000){"Не удалось проверить КБЖУ ИИ. Повторите или заполните вручную."}
        result.put(field,value)
      }
      result
    }
  }
}
