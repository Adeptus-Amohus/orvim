package local.lifeos.client

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import org.json.JSONObject
import org.json.JSONArray

class OrvimBackups(private val activity:Activity) {
  private val preferences=activity.getSharedPreferences("life_backup_folder",Context.MODE_PRIVATE)
  fun intent()=Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
  fun select(data:Intent?):JSONObject {
    val uri=data?.data ?: return status()
    val flags=data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    activity.contentResolver.takePersistableUriPermission(uri,flags)
    val tree=DocumentFile.fromTreeUri(activity,uri) ?: error("Папка недоступна")
    require(tree.canWrite()){"В выбранную папку нельзя записывать"}
    check(preferences.edit().putString("uri",uri.toString()).remove("lastMirrored").commit())
    return status()
  }
  private fun tree():DocumentFile {
    val uri=preferences.getString("uri",null) ?: error("Выберите внешнюю папку резервных копий")
    val folder=DocumentFile.fromTreeUri(activity,Uri.parse(uri)) ?: error("Папка недоступна")
    require(folder.exists()&&folder.canWrite()){"Доступ к папке потерян. Выберите её снова"}
    return folder
  }
  fun status():JSONObject = try{val folder=tree();JSONObject().put("configured",true).put("folder",folder.name ?: folder.uri.toString()).put("lastMirrored",preferences.getString("lastMirrored",null))}catch(error:Exception){JSONObject().put("configured",false).put("message",error.message)}
  private fun valid(name:String)=(name.startsWith("orvim-")||name.startsWith("lifeos-"))&&name.endsWith(".json")&&name.length<180&&name.all{it.isLetterOrDigit()||it in "-._"}
  private fun copies()=tree().listFiles().filter{it.isFile&&valid(it.name ?: "")}.sortedByDescending{it.lastModified()}
  fun action(operation:String,args:JSONObject):JSONObject {
    if(operation=="backupFolderStatus")return status()
    if(operation=="backupMirror") {
      if(preferences.getString("uri",null)==null)return JSONObject().put("configured",false)
      val name=args.getString("name");require(valid(name));val content=args.getString("content");require(content.toByteArray().size<=110*1024*1024)
      val folder=tree();if(folder.findFile(name)!=null)return JSONObject().put("saved",true)
      val partial=folder.createFile("application/json",name+".partial") ?: error("Не удалось создать копию")
      try{activity.contentResolver.openOutputStream(partial.uri,"wt")?.use{it.write(content.toByteArray(Charsets.UTF_8));it.flush()} ?: error("Не удалось записать копию");check(partial.renameTo(name)){"Не удалось завершить копию"}}catch(error:Exception){partial.delete();throw error}
      copies().drop(24).forEach{check(it.delete()){"Не удалось удалить старую копию"}}
      check(preferences.edit().putString("lastMirrored",name).commit())
      return JSONObject().put("saved",true)
    }
    if(operation=="backupExternalList"){val list=JSONArray();copies().forEach{list.put(JSONObject().put("name",it.name).put("at",it.lastModified()).put("bytes",it.length()))};return JSONObject().put("copies",list)}
    if(operation=="backupExternalDelete"&&args.optBoolean("all")){if(preferences.getString("uri",null)!=null)copies().forEach{check(it.delete())};return JSONObject().put("deleted",true)}
    val name=args.getString("name");require(valid(name));val file=copies().find{it.name==name} ?: error("Копия не найдена")
    if(operation=="backupExternalDelete"){check(file.delete());return JSONObject().put("deleted",true)}
    if(operation=="backupExternalRead"){require(file.length()<=110*1024*1024);val text=activity.contentResolver.openInputStream(file.uri)?.use{input->val bytes=java.io.ByteArrayOutputStream();val buffer=ByteArray(65536);while(true){val n=input.read(buffer);if(n<0)break;require(bytes.size()+n<=110*1024*1024){"Копия слишком большая"};bytes.write(buffer,0,n)};bytes.toString("UTF-8")} ?: error("Не удалось прочитать копию");return JSONObject().put("content",text)}
    error("Неизвестное действие резервных копий")
  }
}
